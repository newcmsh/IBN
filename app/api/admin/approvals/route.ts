import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase/admin";

function parseAdminEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

function withAuthCookies(response: NextResponse, cookiesToSet: { name: string; value: string; options?: any }[]) {
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
}

async function requireAdmin(request: NextRequest): Promise<{ ok: true; email: string; cookieResponse: NextResponse } | { ok: false; res: NextResponse }> {
  const adminEmails = parseAdminEmails(process.env.ADMIN_EMAILS);
  if (adminEmails.size === 0) {
    return { ok: false, res: NextResponse.json({ error: "ADMIN_EMAILS가 설정되지 않았습니다." }, { status: 500 }) };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return { ok: false, res: NextResponse.json({ error: "Supabase 환경 변수가 설정되지 않았습니다." }, { status: 500 }) };
  }

  // Route Handler에서는 브라우저 쿠키 세션으로 인증합니다.
  // (관리자 UI에서 별도 Authorization 헤더를 넣지 않아도 동작)
  const cookieResponse = NextResponse.next();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => withAuthCookies(cookieResponse, cookiesToSet),
    },
  });
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email?.toLowerCase() ?? "";
  if (!email || !adminEmails.has(email)) {
    return { ok: false, res: NextResponse.json({ error: "권한이 없습니다(운영자 전용)." }, { status: 403 }) };
  }
  return { ok: true, email, cookieResponse };
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.res;

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase Admin(SUPABASE_SERVICE_ROLE_KEY) 미설정. DB 조회 불가." }, { status: 500 });
  }

  const url = new URL(request.url);
  const statusRaw = (url.searchParams.get("status") ?? "pending").trim().toLowerCase();
  const status =
    statusRaw === "all" || statusRaw === "pending" || statusRaw === "approved" || statusRaw === "rejected"
      ? statusRaw
      : "pending";

  let q = supabaseAdmin
    .from("consultant_profiles")
    .select("user_id,email,full_name,phone,company_name,address,status,requested_at,approved_at,rejected_at,approved_by,note,updated_at");

  if (status !== "all") {
    q = q.eq("status", status);
  }

  const { data, error } = await q
    .order("requested_at", { ascending: false })
    .range(0, 1999);

  if (error) {
    return NextResponse.json({ error: "승인 대기 목록 조회 실패" }, { status: 500 });
  }

  const rows = data ?? [];
  // 기존 클라이언트 호환(pending만 쓰던 시절)
  const res = NextResponse.json({
    status,
    rows,
    pending: status === "pending" ? rows : undefined,
  });
  // 쿠키 갱신이 필요한 경우 반영
  withAuthCookies(res, admin.cookieResponse.cookies.getAll());
  return res;
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return admin.res;

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase Admin(SUPABASE_SERVICE_ROLE_KEY) 미설정. DB 업데이트 불가." }, { status: 500 });
  }

  let body: { userId?: string; action?: "approve" | "reject" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 본문이 올바른 JSON이 아닙니다." }, { status: 400 });
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const action = body.action;
  if (!userId || (action !== "approve" && action !== "reject")) {
    return NextResponse.json({ error: "userId, action(approve|reject) 필수입니다." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const patch =
    action === "approve"
      ? { status: "approved", approved_at: now, rejected_at: null, approved_by: admin.email, updated_at: now }
      : { status: "rejected", rejected_at: now, approved_at: null, approved_by: admin.email, updated_at: now };

  const { error } = await supabaseAdmin
    .from("consultant_profiles")
    .update(patch)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: "승인 처리 실패" }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true });
  withAuthCookies(res, admin.cookieResponse.cookies.getAll());
  return res;
}

