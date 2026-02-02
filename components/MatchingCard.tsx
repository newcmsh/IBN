"use client";

import type { MatchResult } from "@/lib/types";
import { getDDay, getPeriod } from "@/lib/utils/dates";
import { pickAnnouncementSourceLink, pickAnnouncementViewLink } from "@/lib/utils/url";

function formatAmount(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(0)}만`;
  return `${n.toLocaleString()}원`;
}

const CONFIDENCE_LABEL: Record<string, string> = { High: "높음", Medium: "보통", Low: "낮음" };
const CONFIDENCE_CLASS: Record<string, string> = {
  High: "bg-green-100 text-green-800",
  Medium: "bg-amber-100 text-amber-800",
  Low: "bg-slate-100 text-slate-600",
};

function DDayBadge({ dday }: { dday: { label: string | null; daysLeft: number | null; urgent?: boolean } }) {
  if (!dday.label) return null;
  const isUrgent = dday.urgent;
  const displayText =
    dday.label === "D-DAY"
      ? "오늘 마감"
      : dday.label.startsWith("D-") && dday.daysLeft != null && dday.daysLeft <= 7 && dday.daysLeft > 0
        ? `마감임박 ${dday.label}`
        : dday.label;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        dday.label === "마감"
          ? "bg-slate-200 text-slate-600"
          : isUrgent
            ? "bg-rose-100 text-rose-800"
            : "bg-slate-100 text-slate-600"
      }`}
    >
      {isUrgent && dday.label !== "마감" && <span aria-hidden>🔥</span>}
      {displayText}
    </span>
  );
}

export default function MatchingCard({ match, rank }: { match: MatchResult; rank?: number }) {
  const { passed, announcement, score, confidence, reasons, rejectReasons, amountRange } = match;
  const { conservative, base, optimistic } = amountRange;

  const startAt = announcement.startAt ?? announcement.publishedAt;
  const period = getPeriod(startAt, announcement.deadlineAt, announcement.publishedAt);
  const dday = announcement.deadlineAt ? getDDay(announcement.deadlineAt) : { label: null as string | null, daysLeft: null as number | null };
  const viewLink = pickAnnouncementViewLink(announcement);
  const sourceLink = pickAnnouncementSourceLink(announcement);

  return (
    <div className="break-keep rounded-2xl border border-slate-100 bg-white/90 p-5 shadow-sm shadow-slate-200/60 transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {passed && rank != null && (
          <span className="inline-block rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-medium text-primary-700">
            추천 #{rank}
          </span>
        )}
        {!passed && (
          <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
            탈락
          </span>
        )}
        {announcement.deadlineAt && <DDayBadge dday={dday} />}
      </div>

      {period && (
        <p className="text-xs text-slate-500">
          {period.text}
        </p>
      )}

      <p className="mt-1 text-sm font-medium text-slate-500">{announcement.agency}</p>
      <h3 className="mt-1 text-base font-semibold text-slate-800">{announcement.title}</h3>

      <div className="mt-2 flex flex-wrap gap-2">
        {viewLink ? (
          <a
            href={viewLink.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-lg bg-primary-100 px-3 py-1.5 text-sm font-medium text-primary-700 transition hover:bg-primary-200"
          >
            공고 바로가기
          </a>
        ) : (
          <p className="text-sm text-slate-400">바로보기 링크 없음</p>
        )}

        {sourceLink && (!viewLink || sourceLink !== viewLink.href) && (
          <a
            href={sourceLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
          >
            원문(출처) 보기
          </a>
        )}
      </div>

      {passed ? (
        <>
          <div className="mt-4 grid gap-4 md:grid-cols-12">
            <div className="md:col-span-7">
              <p className="text-xs text-slate-500">예상 지원금 (보수·기준·최대)</p>
              <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm font-semibold text-slate-800">
                <span className="whitespace-nowrap text-slate-600">{formatAmount(conservative)}</span>
                <span className="text-slate-400">·</span>
                <span className="whitespace-nowrap text-accent-600">{formatAmount(base)}</span>
                <span className="text-slate-400">·</span>
                <span className="whitespace-nowrap text-slate-700">{formatAmount(optimistic)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 md:col-span-5 md:grid-cols-3">
              <div>
                <p className="text-xs text-slate-500">적합도 점수</p>
                <p className="text-lg font-bold text-primary-600">{score}</p>
              </div>
              {confidence && (
                <div>
                  <p className="text-xs text-slate-500">신뢰도</p>
                  <span
                    className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
                      CONFIDENCE_CLASS[confidence] ?? "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {CONFIDENCE_LABEL[confidence] ?? confidence}
                  </span>
                </div>
              )}
              {announcement.interestRate != null && (
                <div>
                  <p className="text-xs text-slate-500">금리</p>
                  <p className="whitespace-nowrap text-lg font-semibold text-slate-700">{announcement.interestRate}%</p>
                </div>
              )}
            </div>
          </div>
          {reasons.length > 0 && (
            <ul className="mt-3 list-inside list-disc space-y-0.5 text-sm text-slate-600">
              {reasons.slice(0, 3).map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          {rejectReasons && rejectReasons.length > 0 && (
            <ul className="mt-3 list-inside list-disc space-y-0.5 text-sm text-amber-800">
              {rejectReasons.slice(0, 4).map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
