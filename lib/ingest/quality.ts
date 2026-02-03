/**
 * 공고 자금 유형 분류 및 품질 점수 산정
 * - 삭제가 아닌 품질 기준 분리용 (quality_score >= 70 정상, 40~69 정보부족, < 40 검수대상)
 * - 향후 LLM 분류로 확장 가능하도록 키워드 기반 휴리스틱을 상수·함수로 분리
 */

/** 자금 유형 코드 (복수 가능) */
export const FUND_TYPES = ["LOAN", "GUARANTEE", "SUBSIDY", "RND"] as const;
export type FundType = (typeof FUND_TYPES)[number];

/** 품질 점수 입력 (normalize 결과 + raw). raw는 키워드 검색용 텍스트 추출에 사용 */
export interface QualityInput {
  title: string;
  agency: string;
  published_at: string | null;
  deadline_at: string | null;
  max_amount: number | null;
  /** 원문 객체. 문자열화하여 키워드 검색에 사용 (깊이 제한) */
  raw: Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// 자금 유형 분류용 키워드 사전 (향후 LLM/외부 사전으로 교체 가능)
// -----------------------------------------------------------------------------

const KEYWORDS_LOAN = [
  "융자",
  "대출",
  "차입",
  "융자금",
  "시설자금",
  "운전자금",
  "저리융자",
  "정책자금융자",
  "융자지원",
];

const KEYWORDS_GUARANTEE = [
  "보증",
  "신용보증",
  "보증기금",
  "신보",
  "기보",
  "신용보증기금",
  "신용보증재단",
  "기술보증",
  "보증한도",
  "채무보증",
];

const KEYWORDS_SUBSIDY = [
  "보조금",
  "바우처",
  "출연금",
  "지원금",
  "보조",
  "지원사업",
  "보조사업",
  "국고보조",
  "지방비보조",
  "매칭지원",
];

const KEYWORDS_RND = [
  "r&d",
  "연구개발",
  "연구 개발",
  "기술개발",
  "연구개발비",
  "R&D",
  "기술혁신",
  "산학연",
  "과제",
  "연구비",
];

/** 유형별 키워드 (classifyFundTypes에서 순회용) */
const FUND_TYPE_KEYWORDS: { type: FundType; keywords: string[] }[] = [
  { type: "LOAN", keywords: KEYWORDS_LOAN },
  { type: "GUARANTEE", keywords: KEYWORDS_GUARANTEE },
  { type: "SUBSIDY", keywords: KEYWORDS_SUBSIDY },
  { type: "RND", keywords: KEYWORDS_RND },
];

// -----------------------------------------------------------------------------
// 품질 점수용 키워드 (점수 산정·플래그용)
// -----------------------------------------------------------------------------

/** 자금/지원 관련 키워드 존재 시 +15 */
const KEYWORDS_FUND_SUPPORT = [
  "지원",
  "자금",
  "공고",
  "사업",
  "정책자금",
  "지원사업",
  "융자",
  "보증",
  "보조금",
  "바우처",
  "R&D",
  "연구개발",
];

/** 금액/한도 단서 (+10). 숫자+단위는 별도 검사 */
const KEYWORDS_AMOUNT = [
  "한도",
  "금액",
  "억",
  "만원",
  "원",
  "지원한도",
  "최대",
  "한도액",
  "지원규모",
];

/** 신청/접수 단서 (+10) */
const KEYWORDS_APPLICATION = [
  "신청",
  "접수",
  "모집",
  "공고",
  "접수기간",
  "신청기간",
  "지원신청",
];

/** 교육/행사/설명회 성격 (-30 적용 시 사용). 이만 있고 자금 키워드 없으면 행사로 간주 */
const KEYWORDS_EVENT_ONLY = [
  "교육",
  "행사",
  "설명회",
  "세미나",
  "워크숍",
  "오리엔테이션",
  "브리핑",
];

// -----------------------------------------------------------------------------
// 유틸
// -----------------------------------------------------------------------------

function normalizeForMatch(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** raw 객체에서 텍스트 추출 (깊이 제한, 최대 길이 제한). 키워드 검색용 */
function extractTextFromRaw(raw: Record<string, unknown>, maxLen: number = 12000): string {
  const parts: string[] = [];
  function collect(obj: unknown, depth: number): void {
    if (depth > 3) return;
    if (obj == null) return;
    if (typeof obj === "string") {
      parts.push(obj);
      return;
    }
    if (typeof obj === "number" || typeof obj === "boolean") {
      parts.push(String(obj));
      return;
    }
    if (Array.isArray(obj)) {
      for (const v of obj) collect(v, depth + 1);
      return;
    }
    if (typeof obj === "object") {
      for (const v of Object.values(obj)) collect(v, depth + 1);
    }
  }
  collect(raw, 0);
  const joined = parts.join(" ");
  return joined.length > maxLen ? joined.slice(0, maxLen) : joined;
}

function hasAnyKeyword(normalizedText: string, keywords: string[]): boolean {
  const t = normalizeForMatch(normalizedText);
  return keywords.some((kw) => t.includes(normalizeForMatch(kw)));
}

// -----------------------------------------------------------------------------
// 1) 자금 유형 분류 (복수 가능)
// -----------------------------------------------------------------------------

/**
 * 분류용 통합 텍스트 생성 (title + agency + raw 내 문자열). route에서 classifyFundTypes에 넘길 때 사용.
 */
export function getTextForClassification(input: {
  title: string;
  agency: string;
  raw: Record<string, unknown>;
}): string {
  const rawText = extractTextFromRaw(input.raw);
  return [input.title || "", input.agency || "", rawText].filter(Boolean).join(" ");
}

/**
 * title, agency, raw_payload 등에서 추출한 통합 텍스트로 자금 유형 분류.
 * @param text - 검색 대상 텍스트 (예: getTextForClassification(norm) 또는 title + " " + agency + " " + extractTextFromRaw(raw))
 * @returns 매칭된 유형 코드 배열 (중복 제거, 순서: LOAN, GUARANTEE, SUBSIDY, RND)
 */
export function classifyFundTypes(text: string): string[] {
  const t = normalizeForMatch(text || "");
  const found = new Set<string>();
  for (const { type, keywords } of FUND_TYPE_KEYWORDS) {
    if (keywords.some((kw) => t.includes(normalizeForMatch(kw)))) found.add(type);
  }
  return FUND_TYPES.filter((ft) => found.has(ft));
}

// -----------------------------------------------------------------------------
// 2) 품질 점수 산정 (0~100, 플래그 배열)
// -----------------------------------------------------------------------------

/**
 * 공고 품질 점수 및 플래그 산정.
 * - 삭제 없이 분리용: >= 70 정상, 40~69 정보부족, < 40 검수대상(기본 숨김)
 */
export function scoreAnnouncementQuality(input: QualityInput): { score: number; flags: string[] } {
  const flags: string[] = [];
  let score = 0;

  const { title, agency, published_at, deadline_at, max_amount, raw } = input;
  const titleNorm = (title || "").trim();
  const agencyNorm = (agency || "").trim();
  const hasDeadline = !!(deadline_at && String(deadline_at).trim());
  const hasPublished = !!(published_at && String(published_at).trim());
  const hasAmount = max_amount != null && Number(max_amount) > 0;
  const rawText = extractTextFromRaw(raw);
  const combinedText = [titleNorm, agencyNorm, rawText].filter(Boolean).join(" ");
  const combinedNorm = normalizeForMatch(combinedText);

  // 제목 존재: +20
  if (titleNorm.length >= 2) {
    score += 20;
  } else {
    flags.push("missing_title");
  }

  // 기관명 존재: +15
  if (agencyNorm.length >= 2) {
    score += 15;
  } else {
    flags.push("missing_agency");
  }

  // 마감일/기간 존재: +10
  if (hasDeadline || hasPublished) {
    score += 10;
  } else {
    flags.push("missing_deadline");
  }

  // 자금/지원 관련 키워드 존재: +15
  if (hasAnyKeyword(combinedText, KEYWORDS_FUND_SUPPORT)) {
    score += 15;
  } else {
    flags.push("missing_fund_keywords");
  }

  // 금액/한도 단서 존재: +10 (한도 필드 또는 키워드)
  if (hasAmount || hasAnyKeyword(combinedText, KEYWORDS_AMOUNT)) {
    score += 10;
  } else {
    flags.push("missing_amount");
  }

  // 신청/접수 단서 존재: +10
  if (hasAnyKeyword(combinedText, KEYWORDS_APPLICATION)) {
    score += 10;
  } else {
    flags.push("missing_application_clue");
  }

  // 교육/행사/설명회 성격만 있는 경우: -30 (자금·지원 키워드 없고 행사 키워드만 있을 때)
  const hasEventKeywords = hasAnyKeyword(combinedText, KEYWORDS_EVENT_ONLY);
  const hasFundKeywords = hasAnyKeyword(combinedText, KEYWORDS_FUND_SUPPORT);
  if (hasEventKeywords && !hasFundKeywords) {
    score -= 30;
    flags.push("looks_like_event");
  }

  score = Math.max(0, Math.min(100, score));
  return { score, flags };
}
