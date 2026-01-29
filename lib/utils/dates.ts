/**
 * 날짜 유틸: ISO 문자열 파싱, 일수 차이, YMD 포맷, D-day, 기간 표시
 */

/** ISO 문자열 → Date. 유효하지 않으면 null */
export function toDateOrNull(iso: string | undefined | null): Date | null {
  if (iso == null || String(iso).trim() === "") return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 두 날짜 사이 일수 (floor: 자정 기준 정수일). a ≤ b면 양수 */
export function diffDays(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

/** Date → YYYY-MM-DD */
export function formatYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 오늘 자정 (로컬) */
function todayStart(): Date {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

export interface DDayResult {
  label: string | null;
  daysLeft: number | null;
  urgent?: boolean;
}

/**
 * 마감일 기준 D-day
 * - deadline < today => '마감'
 * - daysLeft = 0 => 'D-DAY', urgent
 * - 1~7 => 'D-n', urgent (마감임박)
 * - 8~30 => 'D-n'
 * - 31+ => 'D-n'
 */
export function getDDay(deadlineIso: string | undefined | null): DDayResult {
  const deadline = toDateOrNull(deadlineIso);
  if (!deadline) return { label: null, daysLeft: null };

  const today = todayStart();
  const deadlineStart = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());

  const daysLeft = diffDays(today, deadlineStart);

  if (daysLeft < 0) return { label: "마감", daysLeft: null };
  if (daysLeft === 0) return { label: "D-DAY", daysLeft: 0, urgent: true };
  if (daysLeft <= 7) return { label: `D-${daysLeft}`, daysLeft, urgent: true };
  if (daysLeft <= 30) return { label: `D-${daysLeft}`, daysLeft };
  return { label: `D-${daysLeft}`, daysLeft };
}

export interface PeriodResult {
  text: string;
  startYMD: string;
  endYMD: string;
  totalDays: number;
}

/**
 * 시작~마감 기간 문자열
 * start 없으면 publishedAt 사용. 둘 다 있으면 "YYYY-MM-DD ~ YYYY-MM-DD (총 N일)"
 */
export function getPeriod(
  startIso: string | undefined | null,
  deadlineIso: string | undefined | null,
  publishedAtIso?: string | undefined | null
): PeriodResult | null {
  const deadline = toDateOrNull(deadlineIso);
  if (!deadline) return null;

  const start = toDateOrNull(startIso) ?? toDateOrNull(publishedAtIso);
  if (!start) return null;

  const startYMD = formatYMD(start);
  const endYMD = formatYMD(deadline);
  const totalDays = Math.max(0, diffDays(start, deadline) + 1);

  return {
    text: `${startYMD} ~ ${endYMD} (총 ${totalDays}일)`,
    startYMD,
    endYMD,
    totalDays,
  };
}
