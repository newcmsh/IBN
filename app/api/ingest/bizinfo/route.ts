/**
 * 기업마당(Bizinfo) 지원사업 API 수집 파이프라인
 *
 * 선택: Next.js Route Handler (권장)
 * - BIZINFO_API_KEY를 process.env로만 사용 → 클라이언트 노출 없음
 * - 같은 레포에서 배포·로깅·스케줄 연동이 쉬움
 * - Supabase Edge Function은 별도 배포·env 설정 필요
 *
 * 동작:
 * - Bizinfo API 호출 (JSON 요청, XML 응답 시 파싱)
 * - 원문 → announcement_sources upsert (raw_payload)
 * - 1차 매핑 → grant_announcements upsert (title, agency, url, published_at, deadline_at, max_amount)
 *
 * 환경변수: BIZINFO_API_KEY, BIZINFO_API_BASE_URL(선택), NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { parseApiResponse } from "@/lib/ingest/parseResponse";
import {
  SOURCE_NAME,
  extractItemsFromResponse,
  normalizeItem,
  type BizinfoRawItem,
} from "@/lib/ingest/bizinfo";
import {
  classifyFundTypes,
  getTextForClassification,
  scoreAnnouncementQuality,
} from "@/lib/ingest/quality";

/** 실제 URL은 기업마당 정책정보 개방 또는 공공데이터포털 API 명세 확인 후 BIZINFO_API_BASE_URL로 설정 */
const DEFAULT_BIZINFO_BASE_URL = "https://www.bizinfo.go.kr/api/supportList";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const apiKey = process.env.BIZINFO_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "BIZINFO_API_KEY가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  const baseUrl =
    process.env.BIZINFO_API_BASE_URL?.trim() || DEFAULT_BIZINFO_BASE_URL;
  const url = new URL(baseUrl);
  url.searchParams.set("serviceKey", apiKey);
  url.searchParams.set("type", "json"); // JSON 우선 요청 (API가 지원 시)

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json, application/xml, text/xml, */*" },
      next: { revalidate: 0 },
    });
  } catch {
    console.error("Bizinfo API fetch error");
    return NextResponse.json(
      { error: "Bizinfo API 요청에 실패했습니다.", detail: "FETCH_ERROR" },
      { status: 502 }
    );
  }

  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();

  if (!res.ok) {
    return NextResponse.json(
      { error: "Bizinfo API 오류", status: res.status, body: text.slice(0, 500) },
      { status: 502 }
    );
  }

  const parsed = parseApiResponse(text, contentType);
  if (parsed == null) {
    return NextResponse.json(
      { error: "API 응답 파싱 실패 (JSON/XML 아님 또는 형식 오류)" },
      { status: 502 }
    );
  }

  const items = extractItemsFromResponse(parsed);
  if (items.length === 0) {
    return NextResponse.json({
      ok: true,
      message: "수집된 공고가 없습니다.",
      itemsFetched: 0,
      sourcesUpserted: 0,
      grantsUpserted: 0,
      sample: [],
    });
  }

  const admin = supabaseAdmin;
  if (!admin) {
    return NextResponse.json(
      { error: "Supabase Admin(SUPABASE_SERVICE_ROLE_KEY) 미설정. DB 저장 불가." },
      { status: 500 }
    );
  }

  let sourcesUpserted = 0;
  let grantsUpserted = 0;
  const sample: Array<Record<string, unknown>> = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i] as BizinfoRawItem;
    const norm = normalizeItem(item, i);

    // announcement_sources: 원문 upsert
    const { error: errSource } = await admin
      .from("announcement_sources")
      .upsert(
        {
          source_name: SOURCE_NAME,
          source_ann_id: norm.source_ann_id,
          raw_payload: norm.raw as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "source_name,source_ann_id" }
      );

    if (!errSource) sourcesUpserted++;

    if (sample.length < 3) {
      sample.push({
        source_ann_id: norm.source_ann_id,
        title: norm.title,
        agency: norm.agency,
        url: norm.url,
        published_at: norm.published_at,
        deadline_at: norm.deadline_at,
        max_amount: norm.max_amount,
      });
    }

    // 공고 자금 유형 분류 및 품질 점수 (normalize 이후, upsert 직전)
    const textForType = getTextForClassification({
      title: norm.title,
      agency: norm.agency,
      raw: norm.raw as Record<string, unknown>,
    });
    const fund_types = classifyFundTypes(textForType);
    const { score: quality_score, flags: quality_flags } = scoreAnnouncementQuality({
      title: norm.title,
      agency: norm.agency,
      published_at: norm.published_at,
      deadline_at: norm.deadline_at,
      max_amount: norm.max_amount,
      raw: norm.raw as Record<string, unknown>,
    });

    // grant_announcements: 1차 매핑 + 품질 필드 upsert
    const row: Record<string, unknown> = {
      source_name: SOURCE_NAME,
      source_ann_id: norm.source_ann_id,
      agency: norm.agency,
      title: norm.title,
      max_amount: norm.max_amount ?? 0,
      url: norm.url,
      source_url: norm.url,
      published_at: norm.published_at,
      deadline_at: norm.deadline_at,
      target_criteria: {},
      fund_types,
      quality_score,
      quality_flags,
      updated_at: new Date().toISOString(),
    };

    const { error: errGrant } = await admin
      .from("grant_announcements")
      .upsert(row, { onConflict: "source_name,source_ann_id" });

    if (!errGrant) grantsUpserted++;
  }

  return NextResponse.json({
    ok: true,
    message: "Bizinfo 수집 완료",
    itemsFetched: items.length,
    sourcesUpserted,
    grantsUpserted,
    sample,
  });
}
