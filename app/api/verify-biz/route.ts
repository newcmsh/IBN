/**
 * 사업자상태 검증 API
 * POST /api/verify-biz
 * Body: { bizNo: string }
 * - Mock Provider로 검증 수행
 * - 로그인 사용자면 결과를 company_verifications에 저장 (Authorization: Bearer <supabase_jwt>)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeBizNo } from "@/lib/verification/bizProvider";
import { ntsBizProvider } from "@/lib/verification/ntsProvider";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: { bizNo?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "요청 본문이 올바른 JSON이 아닙니다." },
      { status: 400 }
    );
  }

  const bizNo = typeof body.bizNo === "string" ? body.bizNo.trim() : "";
  const normalized = normalizeBizNo(bizNo);

  if (!normalized) {
    return NextResponse.json(
      { error: "사업자번호를 입력해 주세요.", status: "unknown" },
      { status: 400 }
    );
  }

  const result = await ntsBizProvider.verifyBizStatus(normalized);

  let saved = false;
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (token && supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && anonKey) {
      try {
        const supabase = createClient(url, anonKey, { auth: { persistSession: false } });
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user?.id) {
          const { error: insertErr } = await supabaseAdmin
            .from("company_verifications")
            .insert({
              user_id: user.id,
              payload: {
                bizNo: normalized,
                status: result.status,
                message: result.message,
                verifiedAt: result.verifiedAt,
              },
            });
          saved = !insertErr;
        }
      } catch {
        // 저장 실패해도 검증 결과는 반환
      }
    }
  }

  return NextResponse.json({
    status: result.status,
    message: result.message,
    bizNo: normalized,
    verifiedAt: result.verifiedAt,
    saved,
  });
}
