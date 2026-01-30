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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
    if (!email.trim() || !password) {
      setError("아이디(이메일)와 비밀번호를 입력해 주세요.");
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
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (signUpErr) throw signUpErr;

      // 이메일 확인(Confirm email)이 켜져 있으면 session이 없을 수 있음
      if (data.session) {
        router.replace(redirect);
        return;
      }

      setSuccess("회원가입이 완료되었습니다. 이메일 확인(인증)이 필요할 수 있습니다. 확인 후 로그인해 주세요.");
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
            </div>

            <button
              type="submit"
              disabled={loading}
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

