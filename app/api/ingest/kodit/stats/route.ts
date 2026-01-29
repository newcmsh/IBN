/**
 * 신용보증기금(KODIT) 보증 운영현황 집계 OpenAPI 수집
 * GET /api/ingest/kodit/stats
 * - 연도별·상품유형별 보증 집계 데이터 조회
 * - 원문만 announcement_sources에 저장 (source_name='kodit_stats', source_ann_id=연도+상품유형)
 * - grant_announcements로 매핑하지 않음. 시장 통계/리포트·대시보드용.
 * - KODIT_STATS_API_BASE_URL, KODIT_STATS_API_KEY 사용 (서버 전용, 노출 금지)
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { parseApiResponse } from "@/lib/ingest/parseResponse";
import {
  SOURCE_NAME,
  extractRowsFromResponse,
  toSourceAnnId,
  type KoditStatsRawRow,
} from "@/lib/ingest/koditStats";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(_request: NextRequest) {
  const baseUrl = process.env.KODIT_STATS_API_BASE_URL?.trim();
  const apiKey = process.env.KODIT_STATS_API_KEY;

  if (!baseUrl) {
    return NextResponse.json(
      { error: "KODIT_STATS_API_BASE_URL이 설정되지 않았습니다." },
      { status: 500 }
    );
  }
  if (!apiKey) {
    return NextResponse.json(
      { error: "KODIT_STATS_API_KEY가 설정되지 않았습니다." },
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
  } catch {
    console.error("KODIT stats API fetch error");
    return NextResponse.json(
      { error: "KODIT 보증 운영현황 API 요청에 실패했습니다.", detail: "FETCH_ERROR" },
      { status: 502 }
    );
  }

  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();

  if (!res.ok) {
    return NextResponse.json(
      { error: "KODIT 보증 운영현황 API 오류", status: res.status, body: text.slice(0, 500) },
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

  const rows = extractRowsFromResponse(parsed);
  if (rows.length === 0) {
    return NextResponse.json({
      processed: 0,
      rows: 0,
    });
  }

  const admin = supabaseAdmin;
  if (!admin) {
    return NextResponse.json(
      { error: "Supabase Admin(SUPABASE_SERVICE_ROLE_KEY) 미설정. DB 저장 불가." },
      { status: 500 }
    );
  }

  let processed = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as KoditStatsRawRow;
    const source_ann_id = toSourceAnnId(row, i);

    const { error } = await admin
      .from("announcement_sources")
      .upsert(
        {
          source_name: SOURCE_NAME,
          source_ann_id,
          raw_payload: row as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "source_name,source_ann_id" }
      );

    if (!error) processed++;
  }

  return NextResponse.json({
    processed,
    rows: rows.length,
  });
}
