"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

function IconUser({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M12 12.25a4.25 4.25 0 1 0 0-8.5 4.25 4.25 0 0 0 0 8.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M4.5 20.25a7.5 7.5 0 0 1 15 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

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

function IconPhone({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M8 3.75h8A2.25 2.25 0 0 1 18.25 6v12A2.25 2.25 0 0 1 16 20.25H8A2.25 2.25 0 0 1 5.75 18V6A2.25 2.25 0 0 1 8 3.75Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M10 17.25h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconBuilding({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M7 20.25V5.75a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M5 20.25h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M10 8h4M10 11h4M10 14h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconMap({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M12 21s6-5.05 6-10a6 6 0 1 0-12 0c0 4.95 6 10 6 10Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M12 12.25a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
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

export default function SignupClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";

  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const passwordMismatch = password2.length > 0 && password !== password2;
  const passwordMatch = password2.length > 0 && password.length > 0 && password === password2;

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(redirect);
    });
  }, [supabase, router, redirect]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!supabase) {
      setError("Supabase 환경 변수가 설정되지 않았습니다. (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)");
      return;
    }
    if (!fullName.trim()) {
      setError("이름을 입력해 주세요.");
      return;
    }
    if (!email.trim()) {
      setError("이메일 주소를 입력해 주세요.");
      return;
    }
    if (!phone.trim()) {
      setError("전화번호를 입력해 주세요.");
      return;
    }
    if (!companyName.trim()) {
      setError("회사명을 입력해 주세요.");
      return;
    }
    if (!address.trim()) {
      setError("주소를 입력해 주세요.");
      return;
    }
    if (!password) {
      setError("비밀번호를 입력해 주세요.");
      return;
    }
    if (password.length < 8) {
      setError("비밀번호는 8자 이상을 권장합니다.");
      return;
    }
    if (password !== password2) {
      setError("비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setLoading(true);
    try {
      // 서버에서 계정 생성 + 승인요청 저장 (운영자 승인 구조)
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          companyName: companyName.trim(),
          address: address.trim(),
          password,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error || `회원가입 실패 (${res.status})`);

      // 계정 생성 후 로그인 시도(성공하면 승인대기로 이동)
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInErr) {
        setSuccess("회원가입이 완료되었습니다. 운영자 승인 대기 중입니다. 로그인 화면에서 다시 로그인해 주세요.");
        router.replace(`/login?redirect=${encodeURIComponent("/pending")}`);
        return;
      }

      // 승인 대기 화면으로 이동 (승인 전에는 메인 접근 불가)
      router.replace("/pending");
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "회원가입 중 오류가 발생했습니다.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/60 to-rose-50/60">
      <div className="mx-auto grid min-h-screen max-w-5xl items-center gap-8 px-4 py-10 md:grid-cols-2">
        <div className="hidden md:block">
          <div className="rounded-3xl border border-slate-100 bg-white/70 p-7 shadow-lg shadow-slate-200/50 backdrop-blur">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">
              승인 기반 회원가입
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">상담원 계정 생성</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              가입 후 <span className="font-semibold">운영자 승인</span>이 완료되어야 서비스 이용이 가능합니다.
            </p>
            <div className="mt-6 space-y-3 text-sm text-slate-700">
              <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                제출된 정보는 승인/운영 목적 외에는 사용하지 않습니다.
              </div>
              <div className="rounded-2xl bg-gradient-to-r from-primary-50 to-white px-4 py-3">
                승인 완료 전에는 자동으로 <span className="font-semibold">승인 대기</span> 화면으로 이동합니다.
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-md">
          <div className="rounded-3xl border border-slate-100 bg-white/90 p-7 shadow-lg shadow-slate-200/60 backdrop-blur">
            <div className="mb-6">
              <p className="text-xs font-semibold text-slate-500">CREATE ACCOUNT</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">회원가입</h2>
              <p className="mt-1 text-sm text-slate-500">필수 정보를 입력하고 승인 요청을 제출하세요.</p>
            </div>

          {error && (
            <div className="mb-5 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-5 rounded-2xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700">
              {success}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold text-slate-700">기본 정보</p>
              <div className="mt-3 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700">이름</label>
                  <div className="mt-1 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100">
                    <IconUser className="h-5 w-5 text-slate-400" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                      placeholder="홍길동"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">이메일 주소</label>
                  <div className="mt-1 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100">
                    <IconMail className="h-5 w-5 text-slate-400" />
                    <input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                      placeholder="jh.ub@urbane-gp.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">전화번호</label>
                  <div className="mt-1 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100">
                    <IconPhone className="h-5 w-5 text-slate-400" />
                    <input
                      type="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                      placeholder="010-0000-0000"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold text-slate-700">회사 정보</p>
              <div className="mt-3 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700">회사명</label>
                  <div className="mt-1 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100">
                    <IconBuilding className="h-5 w-5 text-slate-400" />
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                      placeholder="(주)IBN컨설팅"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">주소</label>
                  <div className="mt-1 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100">
                    <IconMap className="h-5 w-5 text-slate-400" />
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                      placeholder="서울특별시 ..."
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">비밀번호</label>
              <div className="mt-1 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100">
                <IconLock className="h-5 w-5 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  placeholder="8자 이상 권장"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                >
                  {showPassword ? "숨김" : "보기"}
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500">승인 기반 운영을 위해 이메일 인증 대신 운영자가 승인합니다.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">비밀번호 확인</label>
              <div className="mt-1 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100">
                <IconLock className="h-5 w-5 text-slate-400" />
                <input
                  type={showPassword2 ? "text" : "password"}
                  autoComplete="new-password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  placeholder="비밀번호를 한 번 더 입력"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword2((p) => !p)}
                  className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  aria-label={showPassword2 ? "비밀번호 숨기기" : "비밀번호 보기"}
                >
                  {showPassword2 ? "숨김" : "보기"}
                </button>
              </div>
              {passwordMismatch && (
                <p className="mt-1 text-xs font-medium text-rose-600">비밀번호가 일치하지 않습니다.</p>
              )}
              {passwordMatch && (
                <p className="mt-1 text-xs font-medium text-green-600">비밀번호가 일치합니다.</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || passwordMismatch}
              className="w-full rounded-2xl bg-primary-500 py-3.5 text-sm font-semibold text-white shadow-md shadow-primary-200 transition hover:bg-primary-400 hover:shadow-lg disabled:opacity-50"
            >
              {loading ? "가입 중..." : "회원가입"}
            </button>
          </form>

          <div className="mt-5 flex items-center justify-between text-sm">
            <span className="text-slate-600">이미 계정이 있나요?</span>
            <Link className="font-semibold text-primary-600 hover:underline" href={`/login?redirect=${encodeURIComponent(redirect)}`}>
              로그인
            </Link>
          </div>

          <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <p className="font-semibold text-slate-700">승인 절차</p>
            <p className="mt-1">회원가입 후 운영자 승인이 완료되어야 서비스 이용이 가능합니다.</p>
          </div>
          </div>
        </div>
      </div>
    </main>
  );
}

