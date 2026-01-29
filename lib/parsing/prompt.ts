/**
 * LLM용 프롬프트 — 공고 원문 → 표준 스키마 JSON
 * 규칙: 반드시 JSON만 출력, 누락은 null 허용, 단위(월/년/원/%/개월) 명시
 * 비용 보호: 원문 상한 길이(12k~20k)로 자르고, 중요 조건(대상/한도/금리/기간) 중심으로 추출
 */

/** 원문 상한 문자 수 (비용·토큰 보호). 12k~20k 범위 */
export const MAX_INPUT_CHARS = 16_000;

export const PARSING_SYSTEM_PROMPT = `당신은 정책자금·지원사업 공고문을 분석해 구조화된 JSON으로만 답하는 도구입니다.
반드시 아래 규칙을 지킵니다.
1. 응답은 반드시 JSON 객체 하나만 출력합니다. 설명·마크다운 코드블록 없이 JSON만 출력합니다.
2. 추출할 수 없는 필드는 null로 둡니다. 빈 배열은 []입니다.
3. 단위: 업력·거치·상환은 모두 "월(개월)" 단위로 숫자만 넣습니다. (예: 3년 → 36, 1년 6개월 → 18)
4. 금리는 "%" 단위 소수(예: 1.5). 한도는 "원" 단위 정수(예: 500000000).
5. 날짜는 가능하면 ISO 8601 문자열(YYYY-MM-DD 또는 YYYY-MM-DDTHH:mm:ssZ)로 합니다.
6. 특히 대상(업종/지역/업력), 지원한도, 금리, 거치·상환 기간, 마감일 등 중요 조건을 우선 추출하세요.`;

export const PARSING_USER_PROMPT_PREFIX = `아래 공고 원문에서 중요 조건(대상/한도/금리/기간)을 중심으로 다음 필드를 추출해 JSON으로만 출력하세요.
단위: 업력/거치/상환 = 월(개월), 금리 = %, 지원한도 = 원. 모르면 null.

필드:
- title(공고 제목), agency(시행 기관), url(상세 URL)
- max_amount(최대 지원금액, 원)
- min_age_months(최소 업력, 월), max_age_months(최대 업력, 월)
- region_sido(대상 시/도 배열), region_sigungu(시/군/구 배열)
- allowed_biz_types(허용 업태 배열): 제조, 도소매, 서비스, 건설 등. 없으면 []
- include_keywords(포함 키워드 배열): 대상 종목/업종명 키워드. 없으면 []
- exclude_keywords(제외 키워드 배열): 제외할 종목/업종 키워드. 없으면 []
- interest_rate_min, interest_rate_max(금리 %), grace_months(거치기간 월), repay_months(상환기간 월)
- deadline_at(신청 마감일 ISO), published_at(공고일 ISO)
- target_criteria(객체): minRevenue, maxRevenue, minYears, maxYears, requiredCerts(배열) 등. 없으면 {}.

원문:
`;

export function buildParsingPrompt(rawText: string, maxChars: number = MAX_INPUT_CHARS): string {
  const truncated = rawText.length > maxChars ? rawText.slice(0, maxChars) + "\n\n[이하 생략]" : rawText;
  return PARSING_USER_PROMPT_PREFIX + truncated;
}
