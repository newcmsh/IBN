/**
 * 중소벤처24 공고(민간공고목록정보=extPblancInfo 등) 수집 파이프라인
 * GET /api/ingest/smes
 * - SMES_API_BASE_URL, SMES_EXT_PBLANC_API_KEY 사용 (서버 전용, 노출 금지)
 * - 원문 → announcement_sources upsert (source_name='smes', source_ann_id, raw_payload)
 * - 공고성 데이터 → grant_announcements upsert (가능한 필드만 1차 매핑)
 * - 응답은 파싱된 sample 3개 포함
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { parseApiResponse } from "@/lib/ingest/parseResponse";
import { SOURCE_NAME, extractItemsFromResponse, normalizeItem, type SmesRawItem } from "@/lib/ingest/smes";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const baseUrl = process.env.SMES_API_BASE_URL?.trim();
  const apiKey = process.env.SMES_EXT_PBLANC_API_KEY;

  if (!baseUrl) {
    return NextResponse.json({ error: "SMES_API_BASE_URL이 설정되지 않았습니다." }, { status: 500 });
  }
  if (!apiKey) {
    return NextResponse.json({ error: "SMES_EXT_PBLANC_API_KEY가 설정되지 않았습니다." }, { status: 500 });
  }

  const url = new URL(baseUrl);
  // 흔한 data.go.kr 패턴
  url.searchParams.set("serviceKey", apiKey);
  url.searchParams.set("returnType", "JSON");

  // 호출자가 추가 쿼리(pageNo/numOfRows 등)를 넣을 수 있도록 전달(충돌 키는 제외)
  request.nextUrl.searchParams.forEach((v, k) => {
    if (k === "serviceKey" || k === "returnType") return;
    url.searchParams.set(k, v);
  });

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json, application/xml, text/xml, */*" },
      next: { revalidate: 0 },
    });
  } catch {
    // fetch 실패면 원문 저장 불가
    return NextResponse.json(
      { error: "SMES API 요청에 실패했습니다.", detail: "FETCH_ERROR" },
      { status: 502 }
    );
  }

  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();

  if (!res.ok) {
    return NextResponse.json(
      { error: "SMES API 오류", status: res.status, body: text.slice(0, 500) },
      { status: 502 }
    );
  }

  const parsed = parseApiResponse(text, contentType);
  if (parsed == null) {
    return NextResponse.json(
      { error: "API 응답 파싱 실패 (JSON/XML 형식 확인)" },
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
    const item = items[i] as SmesRawItem;
    const norm = normalizeItem(item, i);

    // 1) 원문 upsert (최대한 수행)
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

    // sample (최대 3개) – 키/원문 일부만
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

    // 2) 공고 upsert (가능한 필드만)
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
      updated_at: new Date().toISOString(),
    };

    const { error: errGrant } = await admin
      .from("grant_announcements")
      .upsert(row, { onConflict: "source_name,source_ann_id" });
    if (!errGrant) grantsUpserted++;
  }

  return NextResponse.json({
    ok: true,
    message: "SMES 수집 완료",
    itemsFetched: items.length,
    sourcesUpserted,
    grantsUpserted,
    sample,
  });
}

