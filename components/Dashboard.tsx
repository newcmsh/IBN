"use client";

import { useState, useMemo } from "react";
import type { MatchingApiResponse, MatchResult } from "@/lib/types";
import MatchingCard from "./MatchingCard";
import { getDDay } from "@/lib/utils/dates";

function formatAmount(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(0)}만`;
  return `${n.toLocaleString()}원`;
}

type DeadlineFilter = "all" | "7" | "30";

function filterByDeadline(list: MatchResult[], filter: DeadlineFilter): MatchResult[] {
  if (filter === "all") return list;
  const withinDays = filter === "7" ? 7 : 30;
  return list.filter((m) => {
    if (!m.announcement.deadlineAt) return false;
    const dday = getDDay(m.announcement.deadlineAt);
    if (dday.label === "마감") return false; // 이미 마감된 건 제외
    return dday.daysLeft != null && dday.daysLeft >= 0 && dday.daysLeft <= withinDays;
  });
}

export default function Dashboard({ result }: { result: MatchingApiResponse }) {
  const { companyName, totalExpectedAmount, matchCount, recommended, rejected, bestMatch } = result;
  const [activeTab, setActiveTab] = useState<"recommended" | "rejected">("recommended");
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>("all");

  const filteredRecommended = useMemo(
    () => filterByDeadline(recommended, deadlineFilter),
    [recommended, deadlineFilter]
  );
  const filteredRejected = useMemo(
    () => filterByDeadline(rejected, deadlineFilter),
    [rejected, deadlineFilter]
  );

  const totalRange =
    recommended.length > 0
      ? recommended.reduce(
          (acc, m) => ({
            conservative: acc.conservative + m.amountRange.conservative,
            base: acc.base + m.amountRange.base,
            optimistic: acc.optimistic + m.amountRange.optimistic,
          }),
          { conservative: 0, base: 0, optimistic: 0 }
        )
      : null;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-primary-500 to-accent-400 p-6 text-white shadow-lg shadow-primary-200/70">
        <h2 className="text-lg font-medium tracking-tight opacity-90">{companyName} 매칭 요약</h2>
        <p className="mt-2 text-3xl font-semibold tracking-tight">
          총 합산 지원금(총합계) <span className="font-bold">{formatAmount(totalExpectedAmount)}</span>
        </p>
        {totalRange && (
          <p className="mt-1 text-sm opacity-90">
            보수 {formatAmount(totalRange.conservative)} · 기준 {formatAmount(totalRange.base)} · 최대 {formatAmount(totalRange.optimistic)}
          </p>
        )}
        <p className="mt-1 text-sm opacity-80">
          추천 공고 {matchCount}건 · 탈락 공고 {rejected.length}건
        </p>
      </div>

      {bestMatch && (
        <div>
          <h3 className="mb-3 text-base font-semibold text-slate-800">가장 유리한 창구</h3>
          <MatchingCard match={bestMatch} rank={bestMatch.rank ?? 1} />
        </div>
      )}

      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("recommended")}
              className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
                activeTab === "recommended"
                  ? "border-primary-500 text-primary-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
            추천 공고 ({filteredRecommended.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("rejected")}
              className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
                activeTab === "rejected"
                  ? "border-primary-500 text-primary-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
            탈락 공고 ({filteredRejected.length})
            </button>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-slate-500">마감일</span>
            <select
              value={deadlineFilter}
              onChange={(e) => setDeadlineFilter(e.target.value as DeadlineFilter)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-200"
              aria-label="마감일 필터"
            >
              <option value="all">전체</option>
              <option value="7">마감 7일 이내</option>
              <option value="30">마감 30일 이내</option>
            </select>
          </div>
        </div>

        {activeTab === "recommended" && (
          <div className="max-h-[60vh] overflow-y-auto">
            <div className="space-y-4">
              {filteredRecommended.map((m) => (
                <MatchingCard key={m.announcement.annId} match={m} rank={m.rank} />
              ))}
            </div>
          </div>
        )}

        {activeTab === "rejected" && (
          <div className="max-h-[60vh] overflow-y-auto">
            <div className="space-y-4">
              {filteredRejected.map((m) => (
                <MatchingCard key={m.announcement.annId} match={m} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
