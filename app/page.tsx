"use client";

import { useEffect, useState } from "react";
import type { MatchingApiResponse } from "@/lib/types";
import type { CompanyFormData } from "@/components/CompanyForm";
import CompanyForm from "@/components/CompanyForm";
import Dashboard from "@/components/Dashboard";
import { parseRevenueNumber } from "@/lib/utils/koreanNumber";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Home() {
  const router = useRouter();
  const [result, setResult] = useState<MatchingApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/me", { method: "GET" });
        const json = (await res.json().catch(() => ({}))) as { isAdmin?: boolean };
        if (!mounted) return;
        setIsAdmin(json?.isAdmin === true);
      } catch {
        if (!mounted) return;
        setIsAdmin(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSignOut = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      router.replace("/login");
      return;
    }
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const handleSubmit = async (data: CompanyFormData) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const revenue = parseRevenueNumber(data.revenue) || 0;
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: data.companyName,
          revenue,
          bizType: data.bizTypes,
          items: data.items,
          industryKeywords: data.industryKeywords?.length ? data.industryKeywords : undefined,
          estDate: data.estDate || undefined,
          region: data.region || undefined,
          certifications: Array.isArray(data.certifications) ? data.certifications : undefined,
          bizNo: data.bizNo?.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `요청 실패 (${res.status})`);
      }
      const json: MatchingApiResponse = await res.json();
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "매칭 요청 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/60 to-rose-50/60">
      <header className="border-b border-transparent bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">IBN 정책자금 스마트 매칭</h1>
            <p className="mt-0.5 text-sm text-slate-500">내 기업에 딱 맞는 지원금, 부드럽게 한눈에</p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link
                href="/admin/approvals"
                className="rounded-xl bg-slate-900/90 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-900"
              >
                승인관리
              </Link>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
          <aside>
            <CompanyForm onSubmit={handleSubmit} loading={loading} />
          </aside>
          <section>
            {error && (
              <div className="rounded-lg bg-red-50 p-4 text-red-700">
                {error}
              </div>
            )}
            {result && <Dashboard result={result} />}
            {!result && !error && !loading && (
              <div className="rounded-2xl border border-dashed border-slate-200/70 bg-white/70 p-12 text-center text-slate-500 shadow-sm">
                왼쪽에 회사명, 매출, 업태, 종목을 입력한 뒤<br />
                <span className="font-medium text-primary-600">“매칭 결과 보기”</span> 버튼을 눌러보세요.
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
