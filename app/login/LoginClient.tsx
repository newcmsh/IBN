"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

function IconMail({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M4.75 7.5a2.75 2.75 0 0 1 2.75-2.75h9A2.75 2.75 0 0 1 19.25 7.5v9A2.75 2.75 0 0 1 16.5 19.25h-9A2.75 2.75 0 0 1 4.75 16.5v-9Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="m6.5 8.25 5.1 3.4c.25.17.55.26.86.26.31 0 .61-.09.86-.26l5.18-3.45"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconLock({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M7.75 10V8.25A4.25 4.25 0 0 1 12 4a4.25 4.25 0 0 1 4.25 4.25V10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M6.75 10h10.5A1.75 1.75 0 0 1 19 11.75v6.5A1.75 1.75 0 0 1 17.25 20H6.75A1.75 1.75 0 0 1 5 18.25v-6.5A1.75 1.75 0 0 1 6.75 10Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";

  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(redirect);
    });
  }, [supabase, router, redirect]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!supabase) {
      setError("서버 설정이 완료되지 않았습니다. (Supabase 환경 변수 누락)");
      return;
    }
    if (!email.trim() || !password) {
      setError("아이디(이메일)와 비밀번호를 입력해 주세요.");
      return;
    }

    setLoading(true);
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInErr) throw signInErr;
      // 승인 여부는 middleware에서 /pending으로 리다이렉트됩니다.
      router.replace(redirect);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "로그인 중 오류가 발생했습니다.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-80"
        style={{ backgroundImage: "url(/brand/ibn-login-bg.jpg)" }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/70 via-slate-950/55 to-slate-900/65" />

      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-4 py-10 md:grid-cols-2">
        <div className="hidden md:block">
          <div className="max-w-xl">
            <img src="/brand/ibn-logo.png" alt="IBN" className="h-16 w-16 rounded-2xl shadow-lg shadow-black/30" />
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white">
              IBN 정책자금 스마트 매칭
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-200/90">
              내부 상담원을 위한 정책자금 공고 매칭 도구입니다. 기업 정보 기반으로 추천/탈락 공고를 정리하고, 예상 지원금과 근거를 한 번에 확인합니다.
            </p>

            <div className="mt-6 grid gap-3 text-sm text-slate-100/90">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
                로그인 후 승인 상태에 따라 자동으로 <span className="font-semibold text-white">승인 대기</span> 화면으로 이동할 수 있습니다.
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
                관리자는 <span className="font-semibold text-white">회원가입 승인관리</span> 페이지에서 신규 계정을 승인할 수 있습니다.
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-md">
          <div className="rounded-3xl border border-white/10 bg-white/10 p-7 shadow-2xl shadow-black/30 backdrop-blur">
            <div className="mb-6">
              <div className="flex items-center gap-3">
                <img src="/brand/ibn-logo.png" alt="IBN" className="h-10 w-10 rounded-xl" />
                <div>
                  <p className="text-xs font-semibold tracking-wide text-slate-200/80">IBN CONSULTANT</p>
                  <h2 className="mt-0.5 text-2xl font-semibold tracking-tight text-white">로그인</h2>
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-200/80">아이디(이메일)과 비밀번호를 입력해 주세요.</p>
            </div>

          {error && (
            <div className="mb-5 rounded-2xl border border-rose-200/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-100/90">아이디(이메일)</label>
              <div className="mt-1 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-2.5 focus-within:border-white/20 focus-within:ring-2 focus-within:ring-white/10">
                <IconMail className="h-5 w-5 text-slate-200/70" />
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent text-sm text-white placeholder:text-slate-200/50 focus:outline-none"
                  placeholder="jh.ub@urbane-gp.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-100/90">비밀번호</label>
              <div className="mt-1 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-2.5 focus-within:border-white/20 focus-within:ring-2 focus-within:ring-white/10">
                <IconLock className="h-5 w-5 text-slate-200/70" />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent text-sm text-white placeholder:text-slate-200/50 focus:outline-none"
                  placeholder="비밀번호 입력"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-100/80 hover:bg-white/10"
                  aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                >
                  {showPassword ? "숨김" : "보기"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-white py-3.5 text-sm font-semibold text-slate-900 shadow-md shadow-black/30 transition hover:bg-slate-100 disabled:opacity-50"
            >
              {loading ? "로그인 중..." : "로그인"}
            </button>
          </form>

          <div className="mt-5 flex items-center justify-between text-sm">
            <span className="text-slate-200/80">계정이 없나요?</span>
            <Link className="font-semibold text-white hover:underline" href={`/signup?redirect=${encodeURIComponent(redirect)}`}>
              회원가입
            </Link>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-100/80">
            <p className="font-semibold text-white">승인 안내</p>
            <p className="mt-1">회원가입 후 운영자 승인 전에는 자동으로 승인 대기 화면으로 이동합니다.</p>
          </div>
          </div>
        </div>
      </div>
    </main>
  );
}

