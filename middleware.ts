import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function isPublicPath(pathname: string): boolean {
  if (pathname === "/login") return true;
  if (pathname === "/signup") return true;
  if (pathname.startsWith("/api/")) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname === "/robots.txt") return true;
  if (pathname === "/sitemap.xml") return true;
  return false;
}

function parseAdminEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * 로그인 전에는 앱 진입 차단(내부용).
 * - Supabase Auth 세션(쿠키)을 기반으로 /login ↔ / 리다이렉트
 * - Supabase ENV가 없으면(로컬 초기 개발) 차단하지 않음
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // 운영자(관리자) 이메일은 승인 없이도 접근 가능
  const adminEmails = parseAdminEmails(process.env.ADMIN_EMAILS);
  const isAdmin = !!user.email && adminEmails.has(user.email.toLowerCase());

  // /admin/* 은 운영자만 접근
  if (pathname.startsWith("/admin") && !isAdmin) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    return NextResponse.redirect(redirectUrl);
  }

  // 승인 체크: consultant_profiles.status === 'approved' 인 경우에만 앱 이용 가능
  // 운영자는 승인 체크를 생략
  if (!isAdmin) {
    try {
      const { data, error } = await supabase
        .from("consultant_profiles")
        .select("status")
        .eq("user_id", user.id)
        .maybeSingle();

      const status = !error && data?.status ? String(data.status) : "pending";

      if (pathname === "/pending") {
        if (status === "approved") {
          const redirectUrl = request.nextUrl.clone();
          redirectUrl.pathname = "/";
          return NextResponse.redirect(redirectUrl);
        }
      } else {
        if (status !== "approved") {
          const redirectUrl = request.nextUrl.clone();
          redirectUrl.pathname = "/pending";
          return NextResponse.redirect(redirectUrl);
        }
      }
    } catch {
      // 테이블 미생성 등 환경 문제 시, 차단으로 인해 앱이 완전히 멈추지 않도록 통과
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

