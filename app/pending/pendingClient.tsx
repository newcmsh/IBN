"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type ApprovalStatus = "pending" | "approved" | "rejected" | "unknown";

export default function PendingClient() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [status, setStatus] = useState<ApprovalStatus>("unknown");
  const [message, setMessage] = useState<string>("승인 상태를 확인하는 중입니다...");

  useEffect(() => {
    if (!supabase) {
      setStatus("unknown");
      setMessage("Supabase 환경 변수가 설정되지 않았습니다.");
      return;
    }
    let mounted = true;
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data, error } = await supabase
        .from("consultant_profiles")
        .select("status")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!mounted) return;
      const s = !error && data?.status ? String(data.status) : "pending";
      if (s === "approved") {
        setStatus("approved");
        setMessage("승인이 완료되었습니다. 잠시 후 메인 화면으로 이동합니다.");
        setTimeout(() => router.replace("/"), 600);
        return;
      }
      if (s === "rejected") {
        setStatus("rejected");
        setMessage("승인이 거절되었습니다. 운영자에게 문의해 주세요.");
        return;
      }
      setStatus("pending");
      setMessage("회원가입 승인 대기 중입니다. 운영자가 확인 후 승인하면 이용할 수 있습니다.");
    })();
    return () => {
      mounted = false;
    };
  }, [supabase, router]);

  const onLogout = async () => {
    if (!supabase) {
      router.replace("/login");
      return;
    }
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/60 to-rose-50/60">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
        <div className="rounded-2xl border border-slate-100 bg-white/90 p-6 shadow-lg shadow-slate-200/60 backdrop-blur">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">승인 대기</h1>
          <p className="mt-2 text-sm text-slate-600">{message}</p>

          {status === "pending" && (
            <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <p className="font-medium text-slate-700">운영자 승인 방식</p>
              <p className="mt-1">
                내부 운영자가 회원가입 정보를 확인한 뒤 <span className="font-semibold">승인</span>하면 바로 이용할 수 있습니다.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={onLogout}
            className="mt-6 w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            로그아웃
          </button>
        </div>
      </div>
    </main>
  );
}

