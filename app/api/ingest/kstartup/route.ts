/**
 * 창업진흥원 K-Startup 공고 조회 OpenAPI 수집 파이프라인
 * GET /api/ingest/kstartup
 * - KSTARTUP_API_BASE_URL, KSTARTUP_API_KEY 사용 (서버 전용, 노출 금지)
 * - 원문 → announcement_sources upsert (source_name='kstartup', source_ann_id, raw_payload)
 * - 1차 매핑 → grant_announcements upsert (title, agency='창업진흥원', url, published_at, deadline_at, max_amount)
 * - 응답 JSON/XML 모두 파싱 가능
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { parseApiResponse } from "@/lib/ingest/parseResponse";
import {
  SOURCE_NAME,
  extractItemsFromResponse,
  normalizeItem,
  type KstartupRawItem,
} from "@/lib/ingest/kstartup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(_request: NextRequest) {
  const baseUrl = process.env.KSTARTUP_API_BASE_URL?.trim();
  const apiKey = process.env.KSTARTUP_API_KEY;

  if (!baseUrl) {
    return NextResponse.json(
      { error: "KSTARTUP_API_BASE_URL이 설정되지 않았습니다." },
      { status: 500 }
    );
  }
  if (!apiKey) {
    return NextResponse.json(
      { error: "KSTARTUP_API_KEY가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  const url = new URL(baseUrl);
  url.searchParams.set("serviceKey", apiKey);
  url.searchParams.set("returnType", "JSON");

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json, application/xml, text/xml, */*" },
      next: { revalidate: 0 },
    });
  } catch (e) {
    console.error("K-Startup API fetch error");
    return NextResponse.json(
      { error: "K-Startup API 요청에 실패했습니다.", detail: "FETCH_ERROR" },
      { status: 502 }
    );
  }

  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();

  if (!res.ok) {
    return NextResponse.json(
      { error: "K-Startup API 오류", status: res.status, body: text.slice(0, 500) },
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
      sourcesUpserted: 0,
      grantsUpserted: 0,
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

  for (let i = 0; i < items.length; i++) {
    const item = items[i] as KstartupRawItem;
    const norm = normalizeItem(item, i);

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

    const row: Record<string, unknown> = {
      source_name: SOURCE_NAME,
      source_ann_id: norm.source_ann_id,
      agency: norm.agency,
      title: norm.title,
      max_amount: norm.max_amount ?? 0,
      url: norm.url,
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
    message: "K-Startup 수집 완료",
    itemsFetched: items.length,
    sourcesUpserted,
    grantsUpserted,
  });
}
