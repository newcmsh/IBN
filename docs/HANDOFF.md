# 정책자금 스마트 매칭 시스템 — 개발 인수인계 문서 (현행 코드 기준)

이 문서는 **현재 레포(`e:\IBN`)에 구현된 코드 기준**으로, 다른 개발자가 빠르게 구조를 이해하고 운영/확장을 이어갈 수 있도록 정리했습니다.

---

## 1) 한 줄 요약

- **입력(기업)**: 업태(`bizType[]`) + 종목 태그(`items[]`) + 키워드(`industryKeywords[]`) + 인증/자격(`certifications[]`) + (선택) 설립일/지역/사업자번호
- **입력(공고)**: `TargetCriteria.allowed_biz_types / include_keywords / exclude_keywords` + (레거시) 매출/업력/지역 조건
- **출력**: 추천/탈락 공고 전체 + 추천은 `score`·`confidence`·`reasons(3줄)` + 탈락은 `rejectReasons`

---

## 2) 아키텍처/데이터 플로우

### 2.1 화면 → API → 결과

1. `components/CompanyForm.tsx`
   - 매출 입력은 **쉼표 자동 포맷** + **한글 금액(예: 일백만원)** 표시 (`lib/utils/koreanNumber.ts`)
   - 업태는 **복수 선택 체크박스**(`bizTypes: string[]`)
   - 종목/키워드는 **태그 입력** (Enter/쉼표로 추가). 종목을 추가하면 키워드에 자동 반영(중복 제거).
   - 인증/자격은 **대분류 아코디언** UI로 선택(내부 상담용, 보유 여부만).
   - 사업자번호는 “검증” 버튼으로 `POST /api/verify-biz` 호출(실패해도 수동 입력 계속 가능)

2. `app/page.tsx`
   - 폼 데이터를 `POST /api/match`로 전송
   - `revenue` 문자열은 `parseRevenueNumber()`로 숫자 변환

3. `app/api/match/route.ts`
   - 필수 검증: `companyName`, `revenue`, `bizType(1개 이상)`, `items(1개 이상)`
   - `bizType`은 `string | string[]` 모두 허용(서버에서 배열로 정규화)
   - `runFullMatching()` 실행 후 `MatchingApiResponse` 반환

4. `components/Dashboard.tsx` / `components/MatchingCard.tsx`
   - 추천/탈락 탭으로 **제한 없이 전부 표시**
   - 마감 임박(D-day)·기간 표시 (`lib/utils/dates.ts`)
   - 바로보기 링크 품질 정책 적용 (`lib/utils/url.ts`)

---

## 3) 핵심 타입 (중요)

파일: `lib/types.ts`

### 3.1 CompanyProfile (입력)

- `companyName: string`
- `revenue: number`
- `bizType: string[]` (**복수 선택**)
- `items: string[]` (**최소 1개**)
- `industryKeywords?: string[]`
- `certifications?: string[]` (내부 상담용 인증/자격 키)
- `estDate?: string (YYYY-MM-DD)`, `region?: string`, `bizNo?: string`

### 3.2 TargetCriteria (공고 조건)

- `allowed_biz_types?: string[]` (없으면 업태 제한 없음)
- `include_keywords?: string[]` (없으면 키워드 점수 기본 부여)
- `exclude_keywords?: string[]` (매칭되면 탈락)
- (레거시) `minRevenue/maxRevenue`, `minYears/maxYears`, `regions?`, `requiredCerts?`

### 3.3 MatchResult / MatchingApiResponse (출력)

- `MatchResult`
  - `passed: boolean`
  - `score: number (0~100)`
  - `confidence: 'High'|'Medium'|'Low'`
  - `reasons: string[]` (추천일 때 최대 3줄)
  - `rejectReasons?: string[]` (탈락일 때 2~4줄)
  - `amountRange: { conservative, base, optimistic }` + `expectedAmount=base`
- `MatchingApiResponse`
  - `recommended: MatchResult[]`
  - `rejected: MatchResult[]`
  - `bestMatch: MatchResult | null` (추천 1순위)
  - `totalExpectedAmount: number` (추천 expectedAmount 합)

---

## 4) 매칭 알고리즘(현행)

파일: `lib/matching/algorithm.ts`

### 4.1 Hard filter(탈락 조건)

- `allowed_biz_types`가 존재하고 회사 `bizType`이 포함되지 않으면 → `탈락`(rejectReasons: “업태 조건 불충족”)
- `exclude_keywords`가 회사의 `items`/`industryKeywords`에 매칭되면 → `탈락`(“제외 키워드 포함: …”)
- 업력/매출/지역 조건 불충족 시 → `탈락`(각 사유 누적)

### 4.2 Score(0~100)

- 업태 점수(최대 40)
- 종목/키워드 점수(최대 35, include_keywords 매칭 비율 기반)
- 업력/매출/지역 점수(최대 25, 조건 충족 시 분할 가점)
- 내부 상담 인증/자격 가점(최대 +15, 총점 100 상한)

### 4.3 인증/자격 가점 규칙(내부)

코드: `calcCertBonusAndReasons()`

- `venture / innobiz / mainbiz / research_lab`: +4 (해당 그룹 중 하나라도 있으면 근거 1줄 생성)
- `patent`: +3
- `export_experience`: +3 (또는 수출 관련 항목 보유 시 “수출 바우처 적합” 근거 생성)
- `women_owned / disabled_owned / social_enterprise`: +2
- `iso* / isms / haccp / gmp`: +1
- 증빙 가능 상태(E그룹): 점수는 **미반영**, 대신 “서류 준비 가능…” 근거 생성
- 총합 상한: **15점**

### 4.4 confidence / reasons

- `score >= 80` → High(높음)
- `score >= 50` → Medium(보통)
- 그 외 → Low(낮음)
- 추천일 때 `reasons`는 최대 3줄로 제한

### 4.5 추천 정렬(현행)

`runFullMatching()` 기준:

1) `score` 내림차순  
2) 동률이면 `interestRate` 오름차순 (`null`은 999로 취급하여 맨 뒤)  
3) 정렬 후 `rank=1..N` 부여

---

## 5) 공고 데이터 소스(샘플 vs Supabase)

파일: `lib/data/grants.ts`

- **Supabase 연결(supabaseAdmin 사용 가능) + 데이터 존재**: `grant_announcements`에서 가져옴
- **Supabase 연결되어 있는데 데이터 0건**: 샘플을 섞지 않고 **빈 배열 반환**(혼동 방지)
- **Supabase 미연결**: 샘플 5건(`SAMPLE_ANNOUNCEMENTS`)으로 동작

---

## 6) 수집(Ingest) / 파싱(LLM) 파이프라인

### 6.1 원문 저장 테이블

`announcement_sources`에 `(source_name, source_ann_id)`로 upsert, `raw_payload(jsonb)`에 원문 저장.

### 6.2 공고 정규화 테이블

공고성 데이터는 `grant_announcements`에 `(source_name, source_ann_id)`로 upsert.

### 6.3 구현된 엔드포인트

- `GET /api/ingest/bizinfo`
- `GET /api/ingest/smes`
- `GET /api/ingest/kstartup`
- `GET /api/ingest/kodit-stats` (통계 → `announcement_sources`만 저장)
- `GET /api/ingest/koreg/products`
- `GET /api/ingest/parse?source_name=...` (LLM 파싱 배치)

각 ingest는 응답에 `sample` 3개를 포함하도록 구현되어 있습니다.

---

## 7) 사업자 상태조회(국세청 OpenAPI)

파일:

- `lib/verification/ntsProvider.ts`
- `app/api/verify-biz/route.ts`

특징:

- 키: `process.env.NTS_BIZ_API_KEY` (서버 전용)
- 외부 API 오류 시 `status='unknown'`
- 로그인 토큰(`Authorization: Bearer <supabase_jwt>`)이 있고 `supabaseAdmin`이 설정되면 `company_verifications`에 저장

---

## 8) Supabase 스키마/RLS 요약

파일: `supabase/schema.sql`

- `announcement_sources`, `grant_announcements` 포함
- RLS 활성화 + 정책 포함
  - `grant_announcements`, `announcement_sources`: authenticated SELECT만(읽기 전용)
  - insert/update/delete는 서버(service_role)에서만 수행(클라이언트 정책 없음)

---

## 9) 환경 변수(운영 체크리스트)

### 9.1 Supabase

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (서버에서 upsert용)

### 9.2 Ingest/파싱

- `BIZINFO_API_KEY`
- `SMES_API_BASE_URL`, `SMES_EXT_PBLANC_API_KEY`
- `KSTARTUP_API_BASE_URL`, `KSTARTUP_API_KEY`
- `KODIT_STATS_API_BASE_URL`, `KODIT_STATS_API_KEY`
- `KOREG_PRODUCT_API_BASE_URL`, `KOREG_PRODUCT_API_KEY`
- `OPENAI_API_KEY` (+ 선택: `OPENAI_CHAT_MODEL`)

### 9.3 사업자 검증

- `NTS_BIZ_API_KEY`

### 9.4 Electron(내부 PC exe)

- `NEXT_PUBLIC_APP_URL` (exe가 로드할 Vercel URL)

---

## 10) 로컬 확인 체크

1) `npm run dev` 후 폼에서 **업태 1개 이상 + 종목 1개 이상** 입력 → 추천/탈락 결과 표시  
2) 공고의 `exclude_keywords`에 걸리는 종목/키워드 입력 → 해당 공고가 탈락 탭으로 이동  
3) 추천 카드에 `score / 신뢰도 / reasons` 표시 확인  
4) 마감일이 있는 공고에서 D-day/기간 표시 확인  

