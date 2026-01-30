import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Body = {
  fullName?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  address?: string;
  password?: string;
};

function normEmail(v: unknown): string {
  return typeof v === "string" ? v.trim().toLowerCase() : "";
}

function normStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function isEmailLike(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "서버 설정이 완료되지 않았습니다. (SUPABASE_SERVICE_ROLE_KEY 필요)" },
      { status: 500 }
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "요청 본문이 올바른 JSON이 아닙니다." }, { status: 400 });
  }

  const fullName = normStr(body.fullName);
  const email = normEmail(body.email);
  const phone = normStr(body.phone);
  const companyName = normStr(body.companyName);
  const address = normStr(body.address);
  const password = normStr(body.password);

  if (!fullName) return NextResponse.json({ error: "이름은 필수입니다." }, { status: 400 });
  if (!email || !isEmailLike(email)) return NextResponse.json({ error: "이메일 형식을 확인해 주세요." }, { status: 400 });
  if (!phone) return NextResponse.json({ error: "전화번호는 필수입니다." }, { status: 400 });
  if (!companyName) return NextResponse.json({ error: "회사명은 필수입니다." }, { status: 400 });
  if (!address) return NextResponse.json({ error: "주소는 필수입니다." }, { status: 400 });
  if (!password) return NextResponse.json({ error: "비밀번호는 필수입니다." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "비밀번호는 8자 이상을 권장합니다." }, { status: 400 });

  // 1) Auth 사용자 생성 (이메일 인증은 운영자 승인으로 대체 → email_confirm=true)
  const created = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      phone,
      company_name: companyName,
      address,
      signup_source: "app",
    },
  });

  // 이미 존재/제약 오류 등
  if (created.error) {
    const msg = created.error.message || "회원가입 처리 중 오류가 발생했습니다.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const userId = created.data.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "회원가입 처리 실패(사용자 ID 없음)" }, { status: 500 });
  }

  // 2) 승인 대기 프로필 upsert
  const now = new Date().toISOString();
  const { error: profileErr } = await supabaseAdmin
    .from("consultant_profiles")
    .upsert(
      {
        user_id: userId,
        email,
        full_name: fullName,
        phone,
        company_name: companyName,
        address,
        status: "pending",
        requested_at: now,
        updated_at: now,
      },
      { onConflict: "user_id" }
    );

  if (profileErr) {
    // Auth 유저는 생성되었으나 승인 테이블 저장 실패 → 운영자가 스키마 적용 필요
    return NextResponse.json(
      { error: "승인요청 저장에 실패했습니다. (Supabase schema.sql 적용 여부를 확인해 주세요.)" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

