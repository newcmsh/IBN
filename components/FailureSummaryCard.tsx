"use client";

import type { MatchResult } from "@/lib/types";

/** 탈락 공고 전용 카드 (MatchResult passed=false). 레거시/별도 사용 시 */
export default function FailureSummaryCard({ failed }: { failed: MatchResult }) {
  if (failed.passed) return null;
  const { announcement, rejectReasons } = failed;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
      <p className="text-sm font-medium text-amber-800">{announcement.agency}</p>
      <h3 className="mt-1 text-base font-semibold text-slate-800">{announcement.title}</h3>
      <p className="mt-2 text-xs font-medium uppercase tracking-wide text-amber-700">탈락 사유</p>
      {rejectReasons && rejectReasons.length > 0 ? (
        <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-slate-700">
          {rejectReasons.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-slate-600">—</p>
      )}
    </div>
  );
}
