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
type RegionFilter = "all" | "local" | "nationwide";

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

function normalizeForRegion(s: string): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function regionCriteriaMatches(
  criteriaRegions: unknown,
  regionSido?: string,
  regionSigungu?: string
): boolean {
  const list = Array.isArray(criteriaRegions) ? criteriaRegions.map((x) => normalizeForRegion(String(x))).filter(Boolean) : [];
  if (list.length === 0) return false;
  const sido = regionSido ? normalizeForRegion(regionSido) : "";
  const sigungu = regionSigungu ? normalizeForRegion(regionSigungu) : "";
  const combined = normalizeForRegion([regionSido, regionSigungu].filter(Boolean).join(" "));

  return list.some((r) => {
    if (!r) return false;
    if (sido && (sido.includes(r) || r.includes(sido))) return true;
    if (sigungu && (sigungu.includes(r) || r.includes(sigungu))) return true;
    return combined ? combined.includes(r) || r.includes(combined) : false;
  });
}

function filterByRegion(
  list: MatchResult[],
  filter: RegionFilter,
  regionSido?: string,
  regionSigungu?: string
): MatchResult[] {
  if (filter === "all") return list;
  if (filter === "nationwide") {
    return list.filter((m) => !m.announcement.targetCriteria?.regions || (m.announcement.targetCriteria.regions as any[])?.length === 0);
  }
  // local: 지역 조건이 있는 공고 중, 우리 시/도(or 시군구)와 매칭되는 것만
  return list.filter((m) =>
    regionCriteriaMatches(m.announcement.targetCriteria?.regions, regionSido, regionSigungu)
  );
}

export default function Dashboard({ result }: { result: MatchingApiResponse }) {
  const { companyName, totalExpectedAmount, matchCount, recommended, rejected, bestMatch, regionSido, regionSigungu, _meta } = result;
  const [activeTab, setActiveTab] = useState<"recommended" | "rejected">("recommended");
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>("all");
  const [regionFilter, setRegionFilter] = useState<RegionFilter>("all");

  const filteredRecommended = useMemo(
    () => filterByDeadline(filterByRegion(recommended, regionFilter, regionSido, regionSigungu), deadlineFilter),
    [recommended, deadlineFilter, regionFilter, regionSido, regionSigungu]
  );
  const filteredRejected = useMemo(
    () => filterByDeadline(filterByRegion(rejected, regionFilter, regionSido, regionSigungu), deadlineFilter),
    [rejected, deadlineFilter, regionFilter, regionSido, regionSigungu]
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
        {_meta?.announcementsSource === "sample" && (
          <p className="mt-2 rounded-lg bg-white/20 px-3 py-2 text-xs">
            ⚠️ 현재 <strong>데모용 샘플 공고 {_meta.announcementsCount}건</strong>으로 매칭 중입니다. 실제 수집 데이터를 쓰려면 Supabase를 연결하고 수집 API를 실행하세요.{" "}
            <a
              href="/api/grants/status"
              target="_blank"
              rel="noopener noreferrer"
              className="underline opacity-90 hover:opacity-100"
            >
              원인 확인 (상태 API)
            </a>
          </p>
        )}
        {_meta?.announcementsSource === "db" && _meta.announcementsCount === 0 && (
          <p className="mt-2 rounded-lg bg-white/20 px-3 py-2 text-xs">
            수집된 공고가 없습니다. <code className="rounded bg-white/20 px-1">/api/ingest/bizinfo</code> 또는 <code className="rounded bg-white/20 px-1">/api/ingest/smes</code>를 실행해 공고를 수집한 뒤 다시 매칭해 보세요.
          </p>
        )}
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
            {regionSido && (
              <>
                <span className="text-xs text-slate-500">지역</span>
                <select
                  value={regionFilter}
                  onChange={(e) => setRegionFilter(e.target.value as RegionFilter)}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-200"
                  aria-label="지역 필터"
                >
                  <option value="all">전체</option>
                  <option value="local">{regionSido} 대상(지역조건 있는 공고)</option>
                  <option value="nationwide">전국/공통(지역조건 없음)</option>
                </select>
              </>
            )}
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
