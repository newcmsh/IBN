/**
 * 공고 원문 파싱 결과 — grant_announcements 표준 스키마 + target_criteria
 * 단위: 업력·거치·상환 = 월(개월), 금리 = %, 한도 = 원
 * 업종: KSIC 제거, 업태/키워드 기반 (allowed_biz_types, include_keywords, exclude_keywords)
 */

export interface ParsedAnnouncement {
  /** 기본 정보 */
  title?: string | null;
  agency?: string | null;
  url?: string | null;
  max_amount?: number | null;

  /** 업력 (월 단위) */
  min_age_months?: number | null;
  max_age_months?: number | null;

  /** 지역 (시/도, 시/군/구) */
  region_sido?: string[] | null;
  region_sigungu?: string[] | null;

  /** 허용 업태 (제조/도소매/서비스 등). 매칭 Hard filter */
  allowed_biz_types?: string[] | null;
  /** 포함 키워드 (종목/업종명). 매칭 가점 */
  include_keywords?: string[] | null;
  /** 제외 키워드. 매칭 시 탈락 */
  exclude_keywords?: string[] | null;

  /** 금리(%) / 거치(월) / 상환(월) */
  interest_rate_min?: number | null;
  interest_rate_max?: number | null;
  grace_months?: number | null;
  repay_months?: number | null;

  /** 일정 (ISO 문자열) */
  deadline_at?: string | null;
  published_at?: string | null;

  /** 매칭용 유연 필드 (minRevenue, maxRevenue, minYears, requiredCerts 등) */
  target_criteria?: Record<string, unknown> | null;
}
