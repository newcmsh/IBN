/**
 * GET /api/grants/status
 * 매칭에 실제 수집 데이터가 쓰이는지 확인용.
 * - supabaseConfigured: 환경 변수로 Supabase 연결 가능 여부
 * - source: db | sample (매칭 시 사용되는 소스)
 * - count: 공고 건수
 * - error: Supabase 조회 실패 시 오류 메시지 (테이블 없음, RLS 등)
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getGrantAnnouncementsWithSource } from "@/lib/data/grants";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseConfigured = !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  );

  if (!supabaseConfigured) {
    return NextResponse.json({
      supabaseConfigured: false,
      source: "sample",
      count: 5,
      reason:
        "NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없습니다. Vercel이면 대시보드 → Settings → Environment Variables에서 설정하세요.",
    });
  }

  let dbError: string | null = null;
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from("grant_announcements")
      .select("source_ann_id", { count: "exact", head: true });
    if (error) {
      dbError = `${error.code || "ERR"}: ${error.message}`;
    }
  }

  const { announcements, source } = await getGrantAnnouncementsWithSource();

  return NextResponse.json({
    supabaseConfigured: true,
    source,
    count: announcements.length,
    ...(dbError && { error: dbError }),
  });
}
