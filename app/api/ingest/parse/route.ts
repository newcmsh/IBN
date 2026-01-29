/**
 * 공고 원문 LLM 파싱 배치 트리거
 * GET /api/ingest/parse?source_name=bizinfo|smes&limit=50
 * - announcement_sources에서 source_name 기준 최근 n건 조회
 * - raw_payload → 텍스트 추출 → GPT(OpenAI) → 표준 스키마 JSON → grant_announcements upsert
 * - OPENAI_API_KEY, OPENAI_CHAT_MODEL, SUPABASE_SERVICE_ROLE_KEY는 서버에서만 읽음. 키는 로그에 출력하지 않음.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  batchParseAndUpsertFromSource,
  PARSE_LIMIT_DEFAULT,
  PARSE_LIMIT_MAX,
} from "@/lib/parsing";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const sourceName = request.nextUrl.searchParams.get("source_name") ?? undefined;
  const limitParam = request.nextUrl.searchParams.get("limit");

  if (!sourceName) {
    return NextResponse.json(
      { error: "source_name 쿼리 필수 (예: bizinfo, kstartup)" },
      { status: 400 }
    );
  }

  let limit = PARSE_LIMIT_DEFAULT;
  if (limitParam != null) {
    const n = parseInt(limitParam, 10);
    if (!Number.isNaN(n)) limit = Math.min(Math.max(n, 1), PARSE_LIMIT_MAX);
  }

  const admin = supabaseAdmin;
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY 미설정. DB 조회·저장 불가." },
      { status: 500 }
    );
  }

  const result = await batchParseAndUpsertFromSource(
    { source_name: sourceName, limit },
    admin
  );

  if (result.fetchError) {
    return NextResponse.json(
      { error: "announcement_sources 조회 실패", detail: result.fetchError },
      { status: 502 }
    );
  }

  return NextResponse.json({
    processed: result.processed,
    success: result.success,
    failed: result.failed,
    failures: result.failures,
  });
}
