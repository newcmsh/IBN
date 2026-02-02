import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const dynamic = "force-dynamic";

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

/**
 * 관리자 여부를 확인하는 경량 엔드포인트.
 * - 클라이언트에서 "관리자 메뉴" 노출 여부 판단용
 * - 세션 쿠키 기반 (Authorization 헤더 불필요)
 */
export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const adminEmails = parseAdminEmails(process.env.ADMIN_EMAILS);

  // 로컬 초기/설정 누락 시에도 앱이 죽지 않도록 false로 반환
  if (!url || !anonKey || adminEmails.size === 0) {
    return NextResponse.json({ isAdmin: false, email: null });
  }

  const cookieResponse = NextResponse.next();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => withAuthCookies(cookieResponse, cookiesToSet),
    },
  });

  const { data } = await supabase.auth.getUser();
  const email = data.user?.email?.toLowerCase() ?? "";
  const isAdmin = !!email && adminEmails.has(email);

  const res = NextResponse.json({ isAdmin, email: email || null });
  withAuthCookies(res, cookieResponse.cookies.getAll());
  return res;
}

