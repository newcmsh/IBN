/**
 * 업종 마스터 조회 (드롭다운/자동완성)
 * GET /api/industry-master?bizTypes=1 → distinct 업태 목록
 * GET /api/industry-master?q=검색어&bizType=제조 → 업종명 검색, 업태 필터
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface IndustryMasterRow {
  code: string;
  name: string;
  biz_type: string;
  items: string[];
  keywords: string[];
  ksic?: string | null;
}

export async function GET(request: NextRequest) {
  const admin = supabaseAdmin;
  if (!admin) {
    return NextResponse.json(
      { error: "DB를 사용할 수 없습니다." },
      { status: 503 }
    );
  }

  const bizTypesOnly = request.nextUrl.searchParams.get("bizTypes") === "1";
  const q = request.nextUrl.searchParams.get("q")?.trim();
  const bizType = request.nextUrl.searchParams.get("bizType")?.trim();

  if (bizTypesOnly) {
    const { data, error } = await admin
      .from("industry_master")
      .select("biz_type")
      .not("biz_type", "is", null);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    const set = new Set<string>();
    (data ?? []).forEach((r: { biz_type: string }) => r.biz_type && set.add(r.biz_type));
    const bizTypes = Array.from(set).sort();
    return NextResponse.json({ bizTypes });
  }

  let query = admin.from("industry_master").select("code, name, biz_type, items, keywords, ksic");
  if (bizType) query = query.eq("biz_type", bizType);
  if (q) query = query.ilike("name", `%${q}%`);
  query = query.limit(50);

  const { data: rows, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }

  const items = (rows ?? []).map((r: Record<string, unknown>) => ({
    code: r.code,
    name: r.name,
    biz_type: r.biz_type,
    items: Array.isArray(r.items) ? r.items : [],
    keywords: Array.isArray(r.keywords) ? r.keywords : [],
    ksic: r.ksic ?? null,
  })) as IndustryMasterRow[];

  return NextResponse.json({ items });
}
