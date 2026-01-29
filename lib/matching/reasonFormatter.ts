/**
 * matching_results.reason(JSONB) 또는 MatchResult.reason 기반
 * 컨설턴트/고객에게 보여줄 자연어 설명 배열 생성
 * 입력: reason (string | object | array), 선택적으로 scoreBreakdown
 * 출력: string[] — bullet로 출력 가능
 */

export interface ReasonLike {
  items?: string[];
  summary?: string;
  scoreBreakdown?: {
    passFail?: boolean;
    regionScore?: number;
    industryScore?: number;
    revenueScore?: number;
    certBonus?: number;
  };
  [key: string]: unknown;
}

/**
 * reason(JSON 또는 string)을 자연어 설명 배열로 변환.
 * - string: ";" 또는 ","로 구분된 문장을 분리
 * - object: items[] 사용, 없으면 scoreBreakdown 기반 문장 생성
 * - array: 문자열 배열 그대로 사용
 */
export function formatReasonForDisplay(reason: unknown, scoreBreakdown?: ReasonLike["scoreBreakdown"]): string[] {
  if (reason == null) return [];

  if (typeof reason === "string") {
    const trimmed = reason.trim();
    if (!trimmed) return [];
    const split = trimmed.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
    return split.length > 0 ? split : [trimmed];
  }

  if (Array.isArray(reason)) {
    return reason.map((r) => (typeof r === "string" ? r : String(r))).filter(Boolean);
  }

  if (typeof reason === "object") {
    const o = reason as ReasonLike;
    if (Array.isArray(o.items) && o.items.length > 0) {
      return o.items.map((s) => String(s)).filter(Boolean);
    }
    const bullets: string[] = [];
    const sb = o.scoreBreakdown ?? scoreBreakdown;
    if (sb && typeof sb === "object") {
      if (sb.regionScore != null && sb.regionScore > 0) bullets.push(`지역 가점 +${sb.regionScore}점`);
      if (sb.industryScore != null && sb.industryScore > 0) bullets.push(`업종 일치 +${sb.industryScore}점`);
      if (sb.revenueScore != null && sb.revenueScore > 0) bullets.push(`매출 요건 충족 +${sb.revenueScore}점`);
      if (sb.certBonus != null && sb.certBonus > 0) bullets.push(`인증 가점 +${sb.certBonus}점`);
    }
    if (o.summary && typeof o.summary === "string") {
      bullets.push(o.summary.trim());
    }
    if (bullets.length > 0) return bullets;
    if (o.reason && typeof o.reason === "string") {
      return formatReasonForDisplay(o.reason);
    }
  }

  return [String(reason)];
}

/** 탈락 사유(JSONB) 형태 — reason.fail, improveHint */
export interface FailReasonLike {
  fail?: string[];
  improveHint?: string;
  [key: string]: unknown;
}

/**
 * pass_fail=false인 결과의 reason을 사람이 읽기 쉬운 문장 배열로 변환.
 * - reason.fail 배열을 그대로 문장 목록으로 사용
 * - improveHint가 있으면 "보완하면 가능: ..." 형태로 마지막에 추가
 */
export function formatFailReasonForDisplay(reason: unknown): { lines: string[]; improveHint?: string } {
  const result: { lines: string[]; improveHint?: string } = { lines: [] };
  if (reason == null) return result;

  if (typeof reason === "object" && !Array.isArray(reason)) {
    const o = reason as FailReasonLike;
    if (Array.isArray(o.fail) && o.fail.length > 0) {
      result.lines = o.fail.map((s) => (typeof s === "string" ? s.trim() : String(s))).filter(Boolean);
    }
    if (o.improveHint != null && String(o.improveHint).trim()) {
      result.improveHint = String(o.improveHint).trim();
    }
    return result;
  }

  if (typeof reason === "string") {
    const trimmed = reason.trim();
    if (trimmed) result.lines = trimmed.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
    return result;
  }

  if (Array.isArray(reason)) {
    result.lines = reason.map((r) => (typeof r === "string" ? r : String(r))).filter(Boolean);
    return result;
  }

  result.lines = [String(reason)];
  return result;
}
