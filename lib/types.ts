/**
 * 정책자금 스마트 매칭 시스템 - 공통 타입 정의
 * 엑셀/업종마스터 파싱·KSIC 미사용. 업태/종목/키워드 기반으로만 운영.
 */

/** 기업(신청 기업) 프로필 - 컨설팅 신청 시 입력. 업태/종목/키워드 기반 (industryCode·industryName 미사용) */
export interface CompanyProfile {
  id?: string;
  companyName: string;       // 회사명
  revenue: number;           // 매출액 (원)
  /** 업태: 제조/도소매/서비스 등 [필수, 복수 선택 가능] */
  bizType: string[];
  /** 종목 텍스트 배열 (주종목 등) [필수] */
  items: string[];
  /** 매칭용 키워드 배열 [선택] */
  industryKeywords?: string[];
  estDate?: string;          // 설립일 (YYYY-MM-DD)
  region?: string;           // 지역 (시/도)
  /** 정책자금 유리 인증/자격 키 배열 (내부 상담용, 보유 여부만 관리) */
  certifications?: string[];
  bizNo?: string;            // 사업자번호 (자동 연동 시)
  createdAt?: string;
}

/** 공고 정보 (API에서 수집·정제된 데이터) */
export interface GrantAnnouncement {
  annId: string;
  agency: string;           // 시행 기관 (중진공, 소진공, 신보 등)
  title: string;
  maxAmount: number;        // 최대 지원금액 (원)
  targetCriteria: TargetCriteria;
  interestRate?: number;    // 금리 (%)
  gracePeriodMonths?: number; // 거치기간 (월)
  source: DataSource;       // 데이터 출처
  url?: string;
  /** 공고 게시일 (ISO) */
  publishedAt?: string;
  /** 접수 시작일 (ISO). 없으면 publishedAt 사용 */
  startAt?: string;
  /** 접수 마감일 (ISO) */
  deadlineAt?: string;
}

export type DataSource =
  | "bizinfo"      // 기업마당
  | "subsidy24"    // 보조금24
  | "kosbi"        // 중진공
  | "sbc"          // 소진공
  | "kibo"         // 신용보증기금
  | "kodit"        // 신용보증재단
  | "kibo_tech"    // 기술보증기금
  | "kstartup"     // K-Startup
  | "ntis"         // NTIS R&D
  | "moel"         // 고용노동부
  | "kotra"        // 코트라
  | "kita";        // 한국무역협회

export interface TargetCriteria {
  minRevenue?: number;
  maxRevenue?: number;
  minYears?: number;         // 최소 업력
  maxYears?: number;         // 최대 업력
  /** 허용 업태 (제조/도소매/서비스 등). 비어 있으면 제한 없음 */
  allowed_biz_types?: string[];
  /** 포함 키워드 (종목/업종명 등). 하나라도 매칭되면 가점 */
  include_keywords?: string[];
  /** 제외 키워드. 매칭되면 탈락 */
  exclude_keywords?: string[];
  regions?: string[];
  requiredCerts?: string[];  // 벤처, 수출 등
  [key: string]: unknown;
}

/** 지원금 3단계 범위 (보수/기준/최대) — 외부 표시용 */
export interface AmountRange {
  conservative: number;  // 보수적 예상 (원)
  base: number;          // 기준 예상 (원)
  optimistic: number;    // 최대 예상 (원)
}

/** 매칭 신뢰도 (점수 구간) */
export type MatchConfidence = "High" | "Medium" | "Low";

/** 매칭 결과 1건 (추천/탈락 공통) */
export interface MatchResult {
  /** 통과 여부: true=추천, false=탈락 */
  passed: boolean;
  /** 적합도 점수 0~100. 탈락 시 0 */
  score: number;
  /** 신뢰도: High(80+), Medium(50+), Low(50 미만). 탈락 시 의미 없음 */
  confidence: MatchConfidence;
  /** 매칭 사유 최대 3줄 (passed=true일 때) */
  reasons: string[];
  /** 탈락 사유 2~4줄 (passed=false일 때) */
  rejectReasons?: string[];
  announcement: GrantAnnouncement;
  /** 예상 지원금 기준값(원). 탈락 시 0 */
  expectedAmount: number;
  /** 레거시. 탈락 시 0 */
  probability: number;
  /** 지원금 3단계 범위. 탈락 시 0 */
  amountRange: AmountRange;
  /** 레거시: reasons.join(' / ') 또는 rejectReasons.join */
  reason: string;
  /** 추천 순위 (recommended에서만 1..N 부여) */
  rank?: number;
}

/** Open API 응답 - 추천/탈락 전부 포함 */
export interface MatchingApiResponse {
  companyName: string;
  /** 추천 공고 (passed=true) */
  recommended: MatchResult[];
  /** 탈락 공고 (passed=false) */
  rejected: MatchResult[];
  /** 가장 유리한 창구 = recommended[0] */
  bestMatch: MatchResult | null;
  /** recommended의 expectedAmount 합 */
  totalExpectedAmount: number;
  /** recommended.length */
  matchCount: number;
}
