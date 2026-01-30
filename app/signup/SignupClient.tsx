"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

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
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
        <div className="rounded-2xl border border-slate-100 bg-white/90 p-6 shadow-lg shadow-slate-200/60 backdrop-blur">
          <div className="mb-5">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">회원가입</h1>
            <p className="mt-1 text-sm text-slate-500">내부 상담원 계정을 생성합니다.</p>
          </div>

          {error && (
            <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
          )}
          {success && (
            <div className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600">이름</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-300 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                placeholder="홍길동"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600">아이디(이메일)</label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-300 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                placeholder="consultant@company.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600">전화번호</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-300 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                placeholder="010-0000-0000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600">회사명</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-300 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                placeholder="(주)IBN컨설팅"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600">주소</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-300 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                placeholder="서울특별시 ..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600">비밀번호</label>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-300 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                placeholder="8자 이상 권장"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600">비밀번호 확인</label>
              <input
                type="password"
                autoComplete="new-password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-300 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                placeholder="비밀번호를 한 번 더 입력"
              />
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
              className="w-full rounded-xl bg-primary-500 py-3 text-sm font-semibold text-white shadow-md shadow-primary-200 transition hover:bg-primary-400 hover:shadow-lg disabled:opacity-50"
            >
              {loading ? "가입 중..." : "회원가입"}
            </button>
          </form>

          <div className="mt-4 text-sm text-slate-600">
            이미 계정이 있나요?{" "}
            <Link className="font-medium text-primary-600 hover:underline" href={`/login?redirect=${encodeURIComponent(redirect)}`}>
              로그인
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

