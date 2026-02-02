/**
 * 스마트 매칭 엔진
 * - 업태/종목/키워드 기반 Hard filter + Score(업태 40, 키워드/종목 35, 업력/지역/매출 25)
 * - 지원금 3단계·금리/거치 정렬 유지. confidence(High/Medium/Low) + reasons 3줄
 */

import type { CompanyProfile, GrantAnnouncement, MatchResult, TargetCriteria, AmountRange, MatchConfidence, PenaltyFlags } from "@/lib/types";

const REVENUE_CAP_RATIO_CONSERVATIVE = 0.25;
const REVENUE_CAP_RATIO_BASE = 0.35;
const REVENUE_CAP_RATIO_OPTIMISTIC = 0.5;
const REVENUE_CAP_RATIO = REVENUE_CAP_RATIO_CONSERVATIVE;

const INTEREST_RATE_NULL_SENTINEL = 999;
const GRACE_PERIOD_NULL_SENTINEL = -1;

const SCORE_BIZ_TYPE = 40;
const SCORE_KEYWORDS = 35;
const SCORE_OTHER = 25;

/** 인증 가점 상한 (내부 상담용) */
const CERT_BONUS_CAP = 15;

/** 감점 상한 (내부 상담용) */
const PENALTY_CAP = 30;

function calcPenalty(company: CompanyProfile): {
  penalty: number;
  warnings: string[];
  hardFail: boolean;
  hardFailReasons: string[];
} {
  const p = company.penalties ?? {};
  const hardFailReasons: string[] = [];
  const warnings: string[] = [];
  let penalty = 0;

  const hard = (flag: keyof PenaltyFlags, reason: string) => {
    if (p[flag]) hardFailReasons.push(reason);
  };
  const warnPenalty = (flag: keyof PenaltyFlags, warn: string, pts: number) => {
    if (p[flag]) {
      warnings.push(warn);
      penalty += pts;
    }
  };

  // Hard Fail(즉시 탈락)
  hard("businessClosed", "휴/폐업 상태(사업자상태 비정상)");
  hard("inRehabBankruptcy", "회생/파산/청산 진행 중");
  hard("inDefault", "금융 연체/채무불이행(현재)");

  // 체납: 기본 구현은 Hard Fail. (추후 공고별 결격 명시 기반 토글 TODO)
  // TODO: 공고문에 체납 결격이 명시되지 않은 경우, Hard Fail 대신 큰 감점(+경고)로 완화 옵션 적용
  hard("taxArrears", "국세 체납");
  hard("localTaxArrears", "지방세 체납");
  hard("fourInsArrears", "4대보험 체납");

  // Soft penalty(감점)
  warnPenalty("guaranteeAccidentUnresolved", "보증사고 이력(미해소)로 심사 리스크", 20);
  warnPenalty("pastDefaultResolved", "과거 연체 이력(해소) 참고 필요", 8);
  warnPenalty("guaranteeAccidentResolved", "과거 보증사고 이력(해소) 참고 필요", 5);
  warnPenalty("highDebtSuspected", "과다차입 의심(내부 체크) — 추가 확인 권장", 5);

  penalty = Math.min(penalty, PENALTY_CAP);
  return {
    penalty,
    warnings: warnings.slice(0, 3),
    hardFail: hardFailReasons.length > 0,
    hardFailReasons,
  };
}

/** 인증 키별 가점: +4 / +3 / +2 / +1. E그룹(증빙 가능)은 점수 미반영, reason만 */
function calcCertBonusAndReasons(company: CompanyProfile): { bonus: number; reasonLines: string[] } {
  const certs = new Set(company.certifications ?? []);
  let bonus = 0;
  const reasonLines: string[] = [];

  const has = (key: string) => certs.has(key);

  // +4: venture, innobiz, mainbiz, research_lab
  const plus4 = ["venture", "innobiz", "mainbiz", "research_lab"];
  plus4.forEach((key) => {
    if (has(key)) bonus += 4;
  });
  if (plus4.some(has)) {
    reasonLines.push("벤처기업 인증 보유로 기술·R&D 자금 가점 가능");
  }

  // +3: patent, export_experience
  if (has("patent")) {
    bonus += 3;
    reasonLines.push("특허 보유로 기술·지식재산 관련 자금 가점 가능");
  }
  if (has("export_experience")) bonus += 3;
  if (has("export_experience") || has("direct_export") || has("certified_exporter")) {
    if (!reasonLines.some((r) => r.includes("수출"))) {
      reasonLines.push("수출실적 보유 기업으로 수출 바우처 계열 적합");
    }
  }

  // +2: women_owned, disabled_owned, social_enterprise
  ["women_owned", "disabled_owned", "social_enterprise"].forEach((key) => {
    if (has(key)) bonus += 2;
  });

  // +1: iso, haccp, gmp 계열
  ["iso9001", "iso14001", "iso45001", "iso27001", "isms", "haccp", "gmp"].forEach((key) => {
    if (has(key)) bonus += 1;
  });

  // E그룹: 점수 미반영, reason만 (서류 준비 가능)
  const eGroup = ["tax_clearance", "local_tax_clearance", "insurance_clearance"];
  if (eGroup.some(has)) {
    reasonLines.push("납세·4대보험 증빙 가능 상태로 신청 리스크 낮음");
  }

  bonus = Math.min(bonus, CERT_BONUS_CAP);
  return { bonus, reasonLines };
}

function normalizeForMatch(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function companyTextSet(company: CompanyProfile): Set<string> {
  const set = new Set<string>();
  const add = (v: string) => {
    const n = normalizeForMatch(v);
    if (n) set.add(n);
  };
  company.items?.forEach(add);
  company.industryKeywords?.forEach(add);
  (company.bizType ?? []).forEach(add);
  return set;
}

function keywordMatchesAny(keyword: string, textSet: Set<string>): boolean {
  const k = normalizeForMatch(keyword);
  if (!k) return false;
  for (const t of textSet) {
    if (t.includes(k) || k.includes(t)) return true;
  }
  return false;
}

/** Hard filter + 점수(0~100) + 사유. pass=false면 rejectReasons 수집 */
function evaluateBaseCriteria(
  company: CompanyProfile,
  criteria: TargetCriteria
): { pass: boolean; score: number; reasonLines: string[]; rejectReasons?: string[] } {
  const reasonLines: string[] = [];
  const rejectReasons: string[] = [];
  let score = 0;
  const textSet = companyTextSet(company);

  // Hard filter: 업태 제한
  const allowedBiz = criteria.allowed_biz_types?.length ? criteria.allowed_biz_types.map(normalizeForMatch) : null;
  const companyBizNorm = (company.bizType ?? []).map(normalizeForMatch).filter(Boolean);
  if (allowedBiz != null && allowedBiz.length > 0) {
    if (companyBizNorm.length === 0) {
      rejectReasons.push("업태 조건 불충족");
    } else {
      const match = companyBizNorm.some((cb) =>
        allowedBiz!.some((a) => a === cb || cb.includes(a) || a.includes(cb))
      );
      if (!match) rejectReasons.push("업태 조건 불충족");
      else {
        score += SCORE_BIZ_TYPE;
        reasonLines.push("업태 조건 충족");
      }
    }
  } else if (companyBizNorm.length > 0) {
    score += SCORE_BIZ_TYPE;
    reasonLines.push("업태 조건 충족");
  }

  // Hard filter: 제외 키워드
  const excludeKeywords = criteria.exclude_keywords ?? [];
  if (excludeKeywords.length > 0) {
    const matchedKw = excludeKeywords.filter((kw) => keywordMatchesAny(kw, textSet));
    if (matchedKw.length > 0)
      rejectReasons.push(`제외 키워드 포함: ${matchedKw.slice(0, 3).join(", ")}`);
  }

  // 업력
  if (criteria.minYears != null || criteria.maxYears != null) {
    const years = company.estDate ? getYearsFromDate(company.estDate) : null;
    if (years == null) {
      reasonLines.push("업력 정보 없음");
    } else {
      if (criteria.minYears != null && years < criteria.minYears)
        rejectReasons.push("업력 조건 불충족");
      else if (criteria.maxYears != null && years > criteria.maxYears)
        rejectReasons.push("업력 조건 불충족");
      else {
        score += Math.round(SCORE_OTHER / 3);
        reasonLines.push("업력 조건 충족");
      }
    }
  }

  // 매출
  if (criteria.minRevenue != null && company.revenue < criteria.minRevenue)
    rejectReasons.push("매출 조건 불충족");
  else if (criteria.maxRevenue != null && company.revenue > criteria.maxRevenue)
    rejectReasons.push("매출 조건 불충족");
  else if (criteria.minRevenue != null || criteria.maxRevenue != null) {
    score += Math.round(SCORE_OTHER / 3);
    reasonLines.push("매출 조건 충족");
  }

  // 지역
  if (criteria.regions?.length) {
    const companySido = company.regionSido ?? company.region;
    const companySigungu = company.regionSigungu;
    const companyRegionText = [companySido, companySigungu].filter(Boolean).join(" ").trim();
    const companySidoNorm = companySido ? normalizeForMatch(companySido) : "";
    const companySigunguNorm = companySigungu ? normalizeForMatch(companySigungu) : "";
    const companyRegionNorm = companyRegionText ? normalizeForMatch(companyRegionText) : "";

    if (!companyRegionNorm) {
      rejectReasons.push("지역 조건 불충족");
    } else {
      const regionMatch = criteria.regions.some((r) => {
        const rr = normalizeForMatch(String(r));
        if (!rr) return false;
        if (companySidoNorm && (companySidoNorm.includes(rr) || rr.includes(companySidoNorm))) return true;
        if (companySigunguNorm && (companySigunguNorm.includes(rr) || rr.includes(companySigunguNorm))) return true;
        return companyRegionNorm.includes(rr) || rr.includes(companyRegionNorm);
      });
      if (!regionMatch) rejectReasons.push("지역 조건 불충족");
      else {
        score += Math.round(SCORE_OTHER / 3);
        reasonLines.push("지역 조건 충족");
      }
    }
  }

  if (rejectReasons.length > 0)
    return { pass: false, score: 0, reasonLines: [], rejectReasons };

  // 키워드/종목 일치 가점
  const includeKeywords = criteria.include_keywords ?? [];
  if (includeKeywords.length > 0 && textSet.size > 0) {
    const matchCount = includeKeywords.filter((kw) => keywordMatchesAny(kw, textSet)).length;
    if (matchCount > 0) {
      const ratio = Math.min(1, matchCount / Math.max(1, includeKeywords.length));
      score += Math.round(SCORE_KEYWORDS * ratio);
      reasonLines.push("종목·키워드 일치");
    }
  } else if (textSet.size > 0) {
    score += Math.round(SCORE_KEYWORDS * 0.5);
    reasonLines.push("종목 정보 있음");
  }

  return { pass: true, score: Math.min(100, score), reasonLines };
}

function toConfidence(score: number): MatchConfidence {
  if (score >= 80) return "High";
  if (score >= 55) return "Medium";
  return "Low";
}

function toReasonsThree(reasonLines: string[], company: CompanyProfile, _criteria: TargetCriteria): string[] {
  const out: string[] = [];
  for (const r of reasonLines) {
    if (out.length >= 3) break;
    out.push(r);
  }
  if (out.length < 3 && (company.bizType ?? []).length > 0) out.push(`업태: ${company.bizType!.join(", ")}`);
  if (out.length < 3) out.push("조건 충족");
  return out.slice(0, 3);
}

function getYearsFromDate(estDate: string): number {
  const d = new Date(estDate);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

/** 예상 지원금(레거시): min(공고 한도, 매출 * 보수적 비율) — 기준값은 amountRange.base 사용 권장 */
export function calcExpectedAmount(company: CompanyProfile, announcement: GrantAnnouncement): number {
  const capFromRevenue = Math.floor(company.revenue * REVENUE_CAP_RATIO);
  return Math.min(announcement.maxAmount, capFromRevenue);
}

/** 지원금 3단계 범위: 보수적 · 기준 · 최대 (각각 매출 비율 cap 후 공고 한도 min) */
export function calcAmountRange(company: CompanyProfile, announcement: GrantAnnouncement): AmountRange {
  const maxAmount = announcement.maxAmount;
  const conservative = Math.min(maxAmount, Math.floor(company.revenue * REVENUE_CAP_RATIO_CONSERVATIVE));
  const base = Math.min(maxAmount, Math.floor(company.revenue * REVENUE_CAP_RATIO_BASE));
  const optimistic = Math.min(maxAmount, Math.floor(company.revenue * REVENUE_CAP_RATIO_OPTIMISTIC));
  return { conservative, base, optimistic };
}

/** 적합도 점수 0~100. evaluateCriteria.score 사용 */
export function calcProbability(company: CompanyProfile, announcement: GrantAnnouncement): number {
  const r = buildMatchResult(company, announcement);
  return r.passed ? r.score : 0;
}

const ZERO_AMOUNT_RANGE: AmountRange = { conservative: 0, base: 0, optimistic: 0 };

/** 단일 공고에 대한 매칭 결과 생성 (추천/탈락 모두 MatchResult로 반환) */
export function buildMatchResult(company: CompanyProfile, announcement: GrantAnnouncement): MatchResult {
  const penaltyInfo = calcPenalty(company);

  if (penaltyInfo.hardFail) {
    const rejectReasons = penaltyInfo.hardFailReasons.length > 0 ? penaltyInfo.hardFailReasons : ["결격/중대 리스크"];
    return {
      passed: false,
      score: 0,
      confidence: "Low",
      reasons: [],
      rejectReasons: rejectReasons.slice(0, 4),
      announcement,
      expectedAmount: 0,
      probability: 0,
      amountRange: ZERO_AMOUNT_RANGE,
      reason: rejectReasons.join(" / "),
      scoreBreakdown: { base: 0, bonus: 0, penalty: penaltyInfo.penalty, final: 0 },
      flags: { hardFail: true, hardFailReasons: rejectReasons, warnings: penaltyInfo.warnings ?? [] },
    };
  }

  const evalResult = evaluateBaseCriteria(company, announcement.targetCriteria);

  if (!evalResult.pass) {
    const rejectReasons = evalResult.rejectReasons ?? ["조건 불충족"];
    return {
      passed: false,
      score: 0,
      confidence: "Low",
      reasons: [],
      rejectReasons: rejectReasons.slice(0, 4),
      announcement,
      expectedAmount: 0,
      probability: 0,
      amountRange: ZERO_AMOUNT_RANGE,
      reason: rejectReasons.join(" / "),
      scoreBreakdown: { base: 0, bonus: 0, penalty: penaltyInfo.penalty, final: 0 },
      flags: { hardFail: false, hardFailReasons: [], warnings: penaltyInfo.warnings ?? [] },
    };
  }

  const amountRange = calcAmountRange(company, announcement);
  // baseScore(0~70) + bonusScore(<=15) - penaltyScore(<=30)
  const baseScore = Math.round(evalResult.score * 0.7);
  const { bonus: certBonus, reasonLines: certReasonLines } = calcCertBonusAndReasons(company);
  const finalScore = Math.max(0, Math.min(100, baseScore + certBonus - penaltyInfo.penalty));

  // reasons는 상위 3개(적합한 근거). 인증 reason을 우선 포함
  const mergedReasonLines: string[] = [];
  for (const r of [...certReasonLines, ...evalResult.reasonLines]) {
    if (!mergedReasonLines.includes(r)) mergedReasonLines.push(r);
  }
  const reasons = toReasonsThree(mergedReasonLines, company, announcement.targetCriteria);

  return {
    passed: true,
    score: finalScore,
    confidence: toConfidence(finalScore),
    reasons,
    announcement,
    expectedAmount: amountRange.base,
    probability: finalScore,
    amountRange,
    reason: reasons.join(" / "),
    scoreBreakdown: { base: baseScore, bonus: certBonus, penalty: penaltyInfo.penalty, final: finalScore },
    flags: { hardFail: false, hardFailReasons: [], warnings: penaltyInfo.warnings ?? [] },
  };
}

/**
 * 전체 공고에 대해 매칭 후 추천/탈락 분리.
 * recommended: score 내림차순 → 금리 오름차순(interestRate, null=999 맨 뒤), rank 1..N 부여.
 * rejected: 제목순 등 자유 정렬, 제한 없이 전부 반환.
 */
export function runFullMatching(
  company: CompanyProfile,
  announcements: GrantAnnouncement[]
): { recommended: MatchResult[]; rejected: MatchResult[] } {
  const all: MatchResult[] = announcements.map((ann) => buildMatchResult(company, ann));
  const recommended = all.filter((m) => m.passed);
  const rejected = all.filter((m) => !m.passed);

  recommended.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ar = a.announcement.interestRate ?? INTEREST_RATE_NULL_SENTINEL;
    const br = b.announcement.interestRate ?? INTEREST_RATE_NULL_SENTINEL;
    if (ar !== br) return ar - br;
    // optional: 마감 임박 우선(더 빨리 마감되는 공고 먼저)
    const ad = a.announcement.deadlineAt ? new Date(a.announcement.deadlineAt).getTime() : Number.POSITIVE_INFINITY;
    const bd = b.announcement.deadlineAt ? new Date(b.announcement.deadlineAt).getTime() : Number.POSITIVE_INFINITY;
    return ad - bd;
  });
  recommended.forEach((m, i) => {
    m.rank = i + 1;
  });

  rejected.sort((a, b) =>
    (a.announcement.title ?? "").localeCompare(b.announcement.title ?? "", "ko")
  );

  return { recommended, rejected };
}
