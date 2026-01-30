"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type ConsultantProfileRow = {
  user_id: string;
  email: string;
  full_name: string;
  phone: string | null;
  company_name: string | null;
  address: string | null;
  status: string;
  requested_at: string;
};

export default function ApprovalsClient() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<ConsultantProfileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/approvals", { method: "GET" });
      const json = (await res.json()) as any;
      if (!res.ok) throw new Error(json?.error || "조회 실패");
      setRows(Array.isArray(json?.pending) ? json.pending : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "조회 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const act = async (userId: string, action: "approve" | "reject") => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action }),
      });
      const json = (await res.json()) as any;
      if (!res.ok) throw new Error(json?.error || "처리 실패");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "처리 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    if (supabase) await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/60 to-rose-50/60">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">회원가입 승인 관리</h1>
            <p className="mt-1 text-sm text-slate-500">pending 상태 사용자만 표시됩니다.</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            로그아웃
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        )}

        <div className="rounded-2xl border border-slate-100 bg-white/90 shadow-lg shadow-slate-200/60">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <p className="text-sm font-semibold text-slate-800">승인 대기 목록</p>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
            >
              {loading ? "불러오는 중..." : "새로고침"}
            </button>
          </div>

          {rows.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">승인 대기 사용자가 없습니다.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {rows.map((r) => (
                <div key={r.user_id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {r.full_name} <span className="text-slate-400">·</span>{" "}
                      <span className="font-medium text-slate-700">{r.email}</span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      전화: {r.phone ?? "-"} · 회사: {r.company_name ?? "-"} · 주소: {r.address ?? "-"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">요청: {new Date(r.requested_at).toLocaleString()}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => act(r.user_id, "approve")}
                      disabled={loading}
                      className="rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-400 disabled:opacity-50"
                    >
                      승인
                    </button>
                    <button
                      type="button"
                      onClick={() => act(r.user_id, "reject")}
                      disabled={loading}
                      className="rounded-xl bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-300 disabled:opacity-50"
                    >
                      거절
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

