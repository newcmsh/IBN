/**
 * 업종 마스터 일괄 적재 (엑셀 파싱 후 JSON으로 전송)
 * POST /api/ingest/industry-master
 * Body: { rows: Array<{ code, name, biz_type, items?, keywords?, ksic? }> }
 * - code 기준 upsert. KSIC 컬럼은 저장만, 매칭 미사용
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface IndustryMasterInputRow {
  code: string;
  name: string;
  biz_type: string;
  items?: string[];
  keywords?: string[];
  ksic?: string | null;
}

export async function POST(request: NextRequest) {
  const admin = supabaseAdmin;
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY 미설정. DB 저장 불가." },
      { status: 500 }
    );
  }

  let body: { rows?: IndustryMasterInputRow[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "요청 본문이 올바른 JSON이 아닙니다." },
      { status: 400 }
    );
  }

  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, message: "저장할 행이 없습니다." });
  }

  const payloads = rows.map((r) => ({
    code: String(r.code ?? "").trim(),
    name: String(r.name ?? "").trim(),
    biz_type: String(r.biz_type ?? "").trim(),
    items: Array.isArray(r.items) ? r.items : [],
    keywords: Array.isArray(r.keywords) ? r.keywords : [],
    ksic: r.ksic != null ? String(r.ksic).trim() : null,
    updated_at: new Date().toISOString(),
  })).filter((p) => p.code && p.name && p.biz_type);

  let processed = 0;
  for (const p of payloads) {
    const { error } = await admin
      .from("industry_master")
      .upsert(p, { onConflict: "code" });
    if (!error) processed++;
  }

  return NextResponse.json({
    ok: true,
    processed,
    total: rows.length,
    message: "업종 마스터 적재 완료",
  });
}
