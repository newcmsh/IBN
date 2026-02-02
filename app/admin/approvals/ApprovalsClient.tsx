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
  approved_at?: string | null;
  rejected_at?: string | null;
  approved_by?: string | null;
  note?: string | null;
  updated_at?: string | null;
};

export default function ApprovalsClient() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<ConsultantProfileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [query, setQuery] = useState("");

  const load = async (nextTab: typeof tab = tab) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/approvals?status=${encodeURIComponent(nextTab)}`, { method: "GET" });
      const json = (await res.json()) as any;
      if (!res.ok) throw new Error(json?.error || "조회 실패");
      const list = Array.isArray(json?.rows) ? json.rows : Array.isArray(json?.pending) ? json.pending : [];
      setRows(list);
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
      await load(tab);
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = `${r.full_name ?? ""} ${r.email ?? ""} ${r.phone ?? ""} ${r.company_name ?? ""} ${r.address ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query]);

  const statusBadge = (s: string) => {
    const v = String(s || "").toLowerCase();
    if (v === "approved") return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">승인</span>;
    if (v === "rejected") return <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">반려</span>;
    return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">대기</span>;
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/60 to-rose-50/60">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">회원가입 승인 관리</h1>
            <p className="mt-1 text-sm text-slate-500">회원가입한 상담원 계정 목록(대기/승인/반려)을 확인할 수 있습니다.</p>
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
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setTab("pending");
                  void load("pending");
                }}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  tab === "pending" ? "bg-primary-500 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                승인대기
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab("approved");
                  void load("approved");
                }}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  tab === "approved" ? "bg-primary-500 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                승인완료
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab("rejected");
                  void load("rejected");
                }}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  tab === "rejected" ? "bg-primary-500 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                반려
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab("all");
                  void load("all");
                }}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  tab === "all" ? "bg-primary-500 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                전체
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-56 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 placeholder:text-slate-300 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                placeholder="이름/이메일/전화/회사 검색"
              />
              <button
                type="button"
                onClick={() => load(tab)}
                disabled={loading}
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
              >
                {loading ? "불러오는 중..." : "새로고침"}
              </button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">표시할 회원이 없습니다.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <div key={r.user_id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {r.full_name} <span className="text-slate-400">·</span>{" "}
                      <span className="font-medium text-slate-700">{r.email}</span>
                      <span className="ml-2 align-middle">{statusBadge(r.status)}</span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      전화: {r.phone ?? "-"} · 회사: {r.company_name ?? "-"} · 주소: {r.address ?? "-"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      요청: {new Date(r.requested_at).toLocaleString()}
                      {r.approved_at ? ` · 승인: ${new Date(r.approved_at).toLocaleString()}` : ""}
                      {r.rejected_at ? ` · 반려: ${new Date(r.rejected_at).toLocaleString()}` : ""}
                      {r.approved_by ? ` · 처리자: ${r.approved_by}` : ""}
                    </p>
                  </div>
                  {String(r.status || "").toLowerCase() === "pending" ? (
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
                  ) : (
                    <div className="text-right text-xs text-slate-400">
                      {r.note ? <div className="max-w-[320px] truncate">메모: {r.note}</div> : null}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

