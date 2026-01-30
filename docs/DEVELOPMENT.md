# 정책자금 스마트 매칭 시스템 — 개발 문서

다른 개발자가 현재까지 진행된 코드를 이해하고 이어서 개발할 수 있도록 정리한 문서입니다.

> **최신 인수인계 문서(권장)**: `docs/HANDOFF.md`  
> 이 문서는 초기 작성분이 포함되어 있어, 세부가 바뀐 항목(입력 모델/응답 구조/정렬 규칙 등)은 반드시 `docs/HANDOFF.md`와 실제 코드(`lib/types.ts`, `lib/matching/algorithm.ts`, `app/api/*`)를 우선 기준으로 확인하세요.

---

## 1. 프로젝트 개요

### 1.1 목적
- **서비스**: 정책자금 지원 컨설팅용 앱/웹
- **대상**: 컨설팅 신청 기업(회사명, 매출, 직군 등 입력)
- **제공**: 예상 지원금(보수/기준/최대 3단계), 적합도 점수(0~100, 예상 가능성/적합도), 가장 유리한 지원 창구

### 1.2 핵심 기능 (현재 구현)
| 기능 | 설명 | 구현 위치 |
|------|------|------------|
| 기업 정보 입력 | 사업자번호(검증) + 회사명/매출 + **업태(복수)/종목/키워드** + 설립일/지역 + **인증·자격(내부 상담용)** | `components/CompanyForm.tsx` |
| 사업자상태 검증 | 사업자번호 입력 후 "검증" → **국세청(OpenAPI) 상태조회(ntsProvider)** → 실패해도 수동 입력 계속 가능 | `POST /api/verify-biz`, `lib/verification/ntsProvider.ts` |
| 매칭 API | 기업 정보로 지원 공고 매칭 결과 반환 (Open API) | `app/api/match/route.ts` |
| 예상 지원금(3단계) | 보수/기준/최대(매출 비율 0.25/0.35/0.5 cap 후 공고 한도 min) | `lib/matching/algorithm.ts` (calcAmountRange) |
| 적합도 점수(0~100) | Hard filter + score(0~100) + 신뢰도(confidence) + 사유(reasons/rejectReasons) | `lib/matching/algorithm.ts` |
| 추천 정렬 | **score 내림차순 → 금리 오름차순(null은 뒤로)**, rank 부여 | `lib/matching/algorithm.ts` (runFullMatching) |
| 대시보드 UI | 총 예상 지원금(보수·기준·최대), 추천/탈락 탭, 마감일 필터, 카드별 D-day/기간/사유 | `components/Dashboard.tsx`, `components/MatchingCard.tsx` |

### 1.3 데이터 소스 (연동 예정)
기본은 **샘플 공고 5건**으로 동작하지만, **Supabase에 수집된 공고(`grant_announcements`)가 있으면 우선 사용**합니다. 실제 연동 대상:  
기업마당, 보조금24, 중진공, 소진공, 신용보증기금, 신용보증재단, 기술보증기금, K-Startup, NTIS, 고용노동부, 코트라, 한국무역협회 등 (API KEY 사용).

---

## 2. 기술 스택 및 의존성

### 2.1 사용 기술
- **Runtime**: Node.js
- **Framework**: Next.js 14 (App Router)
- **UI**: React 18, Tailwind CSS 3
- **언어**: TypeScript 5
- **DB/Backend(선택)**: Supabase (PostgreSQL, Auth)

### 2.2 package.json 의존성 요약
```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0",  // Supabase 클라이언트 (선택)
    "next": "14.1.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/node", "@types/react", "@types/react-dom",
    "autoprefixer", "postcss", "tailwindcss", "typescript",
    "eslint", "eslint-config-next"
  }
}
```

### 2.3 주요 설정 파일
| 파일 | 역할 |
|------|------|
| `next.config.js` | Next.js 설정 (reactStrictMode 등) |
| `tailwind.config.js` | Tailwind 테마(primary, accent 색상 등) |
| `tsconfig.json` | TypeScript 경로 별칭 `@/*` → 프로젝트 루트 |
| `postcss.config.js` | Tailwind + Autoprefixer |

---

## 3. 디렉터리 구조

```
IBN/
├── app/                      # Next.js App Router
│   ├── api/
│   │   └── match/
│   │       └── route.ts      # POST /api/match (매칭 Open API)
│   ├── globals.css           # 전역 Tailwind
│   ├── layout.tsx            # 루트 레이아웃, 메타데이터
│   └── page.tsx              # 메인 페이지 (폼 + 결과 영역)
├── components/
│   ├── CompanyForm.tsx       # 기업 정보 입력 폼
│   ├── Dashboard.tsx         # 매칭 요약 + 카드 그리드
│   └── MatchingCard.tsx      # 매칭 1건 카드 UI
├── lib/
│   ├── types.ts              # 공통 타입 (CompanyProfile, GrantAnnouncement 등)
│   ├── matching/
│   │   └── algorithm.ts      # 매칭 엔진 (예상금·확률·정렬)
│   ├── verification/         # 사업자상태 검증 (국세청 OpenAPI Provider 포함)
│   │   ├── bizProvider.ts    # VerifyBizResult, BizVerificationProvider, mockBizProvider
│   │   └── index.ts
│   ├── data/
│   │   └── grants.ts         # 공고 데이터 (현재 샘플, 추후 API 연동)
│   ├── parsing/              # 공고 원문 → LLM → 표준 스키마 + target_criteria
│   │   ├── types.ts          # ParsedAnnouncement
│   │   ├── prompt.ts         # LLM 프롬프트 (JSON만, 단위 명시)
│   │   ├── parseWithLLM.ts   # parseWithLLM 추상화 + OpenAI 구현 (서버 전용)
│   │   ├── batch.ts          # batchParseAndUpsert, extractTextFromRawPayload
│   │   └── index.ts
│   └── supabase/
│       └── client.ts         # Supabase 클라이언트 (env 없으면 null)
├── supabase/
│   └── schema.sql            # user_profiles, announcement_sources, grant_announcements(정규화)
├── docs/
│   ├── DEVELOPMENT.md        # 본 개발 문서
│   └── API_INTEGRATION.md    # 공공 API 연동 가이드
├── .env.example              # 환경 변수 템플릿
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
└── next.config.js
```

---

## 4. 데이터 모델 (타입 정의)

파일: **`lib/types.ts`**

### 4.1 CompanyProfile (기업 프로필)
컨설팅 신청 시 입력하는 기업 정보.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| companyName | string | ○ | 회사명 |
| revenue | number | ○ | 매출액 (원) |
| bizType | string[] | ○ | 업태(제조/도소매/서비스 등). **복수 선택** |
| items | string[] | ○ | 종목 텍스트 배열. **최소 1개** |
| industryKeywords | string[] | | 매칭 키워드(종목에서 자동 반영 + 추가/삭제 가능) |
| estDate | string | | 설립일 (YYYY-MM-DD) |
| region | string | | 지역 (시/도) |
| certifications | string[] | | 인증/자격 키 배열(내부 상담용, 보유 여부만) |
| bizNo | string | | 사업자번호 (자동 연동 시) |

### 4.2 GrantAnnouncement (공고 정보)
API에서 수집·정제된 지원 공고 1건.

| 필드 | 타입 | 설명 |
|------|------|------|
| annId | string | 공고 고유 ID |
| agency | string | 시행 기관 (중진공, 소진공 등) |
| title | string | 공고 제목 |
| maxAmount | number | 최대 지원금액 (원) |
| targetCriteria | TargetCriteria | 업력, 매출, 업종, 지역, 인증 등 조건 |
| interestRate | number | 금리 (%) |
| gracePeriodMonths | number | 거치기간 (월) |
| source | DataSource | 데이터 출처 (bizinfo, kosbi, ntis 등) |

### 4.3 TargetCriteria (공고별 지원 조건)
| 필드 | 타입 | 설명 |
|------|------|------|
| minRevenue, maxRevenue | number | 매출 범위 |
| minYears, maxYears | number | 업력(년) 범위 |
| allowed_biz_types | string[] | 허용 업태(없으면 제한 없음) |
| include_keywords | string[] | 포함 키워드(매칭 비율로 점수 반영) |
| exclude_keywords | string[] | 제외 키워드(매칭되면 탈락) |
| regions | string[] | 대상 지역 |
| requiredCerts | string[] | 필수 인증 (벤처 등) |

### 4.4 MatchResult (매칭 결과 1건)
| 필드 | 타입 | 설명 |
|------|------|------|
| passed | boolean | 추천(true) / 탈락(false) |
| score | number | 적합도 점수 0~100 (탈락 시 0) |
| confidence | 'High' \| 'Medium' \| 'Low' | 신뢰도(점수 구간) |
| reasons | string[] | 추천 사유 최대 3줄 (passed=true) |
| rejectReasons | string[] | 탈락 사유 2~4줄 (passed=false) |
| announcement | GrantAnnouncement | 해당 공고 |
| expectedAmount | number | 예상 지원금 기준값(원). 레거시·요약용 |
| probability | number | 레거시 유지(현재 score와 동일 사용) |
| amountRange | AmountRange | 지원금 3단계: conservative(보수), base(기준), optimistic(최대) |
| reason | string | 유리한 이유 요약 |
| rank | number | 추천 순위 (recommended에서만 부여) |

### 4.5 MatchingApiResponse (Open API 응답)
| 필드 | 타입 | 설명 |
|------|------|------|
| companyName | string | 요청한 회사명 |
| recommended | MatchResult[] | 추천 공고 전체(passed=true) |
| rejected | MatchResult[] | 탈락 공고 전체(passed=false) |
| bestMatch | MatchResult \| null | recommended[0] (없으면 null) |
| totalExpectedAmount | number | recommended의 expectedAmount 합 |
| matchCount | number | recommended.length |

---

## 5. 핵심 모듈 상세

### 5.1 매칭 알고리즘 — `lib/matching/algorithm.ts`

**역할**: 기업 프로필과 공고 목록을 받아, 조건 충족 여부·지원금 3단계(보수/기준/최대)·적합도 점수(예상 가능성/적합도)·순위를 계산합니다.

**주요 상수**
- `REVENUE_CAP_RATIO = 0.25`  
  예상 지원금 산출 시 “매출의 25%”를 상한으로 사용 (보수적).

**주요 함수**

| 함수 | 설명 |
|------|------|
| `evaluateCriteria(company, criteria)` | Hard filter(업태/제외키워드/업력/매출/지역) + score(0~100) + reasonLines/rejectReasons 계산 |
| `getYearsFromDate(estDate)` | 설립일로부터 현재까지 연수(업력) 계산. |
| `calcExpectedAmount(company, announcement)` | `min(공고 한도, 매출 × 0.25)` 로 예상 지원금(레거시) 계산. |
| `calcAmountRange(company, announcement)` | 지원금 3단계: conservative(매출×0.25), base(매출×0.35), optimistic(매출×0.5), 각각 공고 한도 cap. |
| `calcProbability(company, announcement)` | 레거시 유지(현재는 evaluateCriteria.score를 사용) |
| `buildMatchResult(company, announcement)` | 단일 공고 평가 결과를 추천/탈락 모두 `MatchResult`로 반환 |
| `runFullMatching(company, announcements)` | 전체 공고 평가 후 recommended/rejected 분리. recommended 정렬: **score desc → interestRate asc(null은 뒤로)**, rank 부여 |

**추천 정렬 및 null 처리 (runFullMatching)**

- 1순위: `score` 내림차순
- 2순위(동률): `announcement.interestRate` 오름차순
  - `interestRate=null`은 `999`로 취급하여 **맨 뒤**

**입력 기반**

- 업종/KSIC 기반 매칭은 사용하지 않고, **업태(`bizType[]`) + 종목/키워드(`items[]`, `industryKeywords[]`)** 기반으로만 평가합니다.

---

### 5.2 공고 데이터 — `lib/data/grants.ts`

**역할**: 매칭에 사용할 공고 목록을 반환합니다.

**제공**
- `SAMPLE_ANNOUNCEMENTS`: GrantAnnouncement[] (중진공, 소진공, 신보, K-Startup, NTIS 예시)
- `getGrantAnnouncements()`: `Promise<GrantAnnouncement[]>`  
  - Supabase에 수집된 공고(`grant_announcements`)가 있으면 우선 사용
  - Supabase가 연결되어 있으나 0건이면 샘플을 섞지 않고 빈 배열 반환(혼동 방지)
  - Supabase 미연결/오류 시 샘플로 fallback

**공고 1건 예시 (타입 기준)**
- `annId`, `agency`, `title`, `maxAmount`, `interestRate`, `gracePeriodMonths`, `source`
- `targetCriteria`: `minRevenue`, `maxRevenue`, `minYears`, `maxYears`, `requiredCerts` 등

---

### 5.3 매칭 API — `app/api/match/route.ts`

**엔드포인트**: `POST /api/match`  
**역할**: Open API. 요청 Body의 기업 정보로 매칭을 수행하고 JSON으로 결과를 반환합니다.

**요청 (Request Body, JSON)**
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| companyName | string | ○ | 회사명 |
| revenue | number | ○ | 매출액 (원) |
| bizType | string \| string[] | ○ | 업태(1개 이상). 서버에서 배열로 정규화 |
| items | string[] | ○ | 종목(1개 이상) |
| industryKeywords | string[] | | 키워드 |
| estDate | string | | 설립일 YYYY-MM-DD |
| region | string | | 지역 |
| certifications | string[] | | 보유 인증 배열 |

**응답 (200)**
- `MatchingApiResponse` 형태: `companyName`, `recommended`, `rejected`, `bestMatch`, `totalExpectedAmount`, `matchCount`

**에러**
- 400: `companyName` 또는 `revenue` 누락 시 `{ error: "companyName, revenue 필수입니다." }`
- 500: 예외 시 `{ error: "매칭 처리 중 오류가 발생했습니다." }`

**처리 흐름**
1. Body 파싱 → `CompanyProfile` 형태로 정규화
2. `getGrantAnnouncements()` 로 공고 목록 조회
3. `runFullMatching(company, announcements)` 호출
4. `totalExpectedAmount`, `bestMatch`(첫 번째 결과) 계산 후 JSON 반환

---

## 6. UI 컴포넌트

### 6.1 메인 페이지 — `app/page.tsx`

- **역할**: 화면 전체 구성. 왼쪽에 기업 정보 폼, 오른쪽에 결과(또는 안내 문구/에러).
- **상태**: `result`(매칭 결과), `loading`, `error`
- **흐름**: `CompanyForm`에서 제출 → `handleSubmit`에서 `POST /api/match` 호출 → 성공 시 `Dashboard`에 `result` 전달, 실패 시 `error` 표시.
- **폼 → API 변환**: `revenue`는 `parseRevenueNumber()`로 정수 파싱, `bizTypes/items/industryKeywords/certifications`는 배열 그대로 전달.

### 6.2 CompanyForm — `components/CompanyForm.tsx`

- **역할**: 기업 정보 입력 폼. **1단계**: 사업자번호 입력 + "검증" 버튼으로 사업자상태 검증 후, 회사명·매출 등 입력.
- **Props**: `onSubmit(data: CompanyFormData)`, `loading?: boolean`
- **CompanyFormData**: `bizNo`, `companyName`, `revenue(문자열)`, `bizTypes[]`, `items[]`, `industryKeywords[]`, `estDate`, `region`, `certifications[]`
- **검증 흐름**: "검증" 클릭 → `POST /api/verify-biz` 호출 → 성공(active) 시 안내, 실패(휴폐업/미확인) 시 메시지 + "수동 입력으로 계속 진행할 수 있습니다." 표시. 수동 입력은 항상 가능.
- **UI**: Tailwind로 레이블·입력·검증 버튼·결과 메시지·제출 버튼 스타일링.

### 6.3 Dashboard — `components/Dashboard.tsx`

- **역할**: `MatchingApiResponse`를 받아 요약 + “가장 유리한 창구” + 추천/탈락 탭(전부 표시) + 마감일 필터 표시.
- **표시 내용**: 회사명, 총 합산 지원금, 보수·기준·최대 합계, 추천/탈락 건수, bestMatch 1건, 추천/탈락 카드 그리드.

### 6.4 MatchingCard — `components/MatchingCard.tsx`

- **역할**: 매칭 1건 카드.
  - 추천: rank/score/confidence/reasons 표시
  - 탈락: “탈락” 뱃지 + rejectReasons 표시
  - 공통: 마감 D-day/기간 표시(가능할 때) + URL 품질 정책에 따른 “공고 바로가기” 표시
- **Props**: `match: MatchResult`, `rank?: number`
- **금액 표시**: 1억 이상은 “N억”, 1만 이상은 “N만” 등으로 포맷 (`formatAmount`).
- **바로보기 링크(URL) 정책**:
  - `announcement.url`은 “가장 신뢰 가능한 바로보기 링크”로만 사용 (placeholder/루트 URL 등은 버튼 숨김 처리).
  - 소스별로 URL 제공 여부가 다르므로, 초기에는 **bizinfo/k-startup/ntis처럼 URL이 제공되는 소스 중심**으로 바로보기를 제공하는 것이 안정적입니다.
  - 수집 원문 출처 링크는 `announcement.sourceUrl`로 분리(선택)해, `url`이 없을 때 UI에서 대체로 사용할 수 있습니다.

### 6.5 레이아웃·스타일

- **app/layout.tsx**: `<html lang="ko">`, 메타데이터(title, description), `globals.css` 로드.
- **app/globals.css**: Tailwind 디렉티브 + CSS 변수(foreground, background).
- **tailwind.config.js**: `primary`, `accent` 색상 확장.

---

## 7. 데이터베이스 스키마

파일: **`supabase/schema.sql`**

### 7.1 user_profiles (기업 프로필)
| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | UUID | PK, default gen_random_uuid() |
| biz_no | TEXT | UNIQUE |
| company_name | TEXT | NOT NULL |
| revenue | BIGINT | NOT NULL |
| industry_code | TEXT | |
| industry_name | TEXT | |
| est_date | DATE | |
| region | TEXT | |
| certifications | TEXT[] | default '{}' |
| created_at | TIMESTAMPTZ | default now() |
| updated_at | TIMESTAMPTZ | default now() |

### 7.2 announcement_sources (공고 원문 저장)
| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | UUID | PK, default gen_random_uuid() |
| source_name | TEXT | NOT NULL, (source_name, source_ann_id) UNIQUE |
| source_ann_id | TEXT | NOT NULL |
| raw_payload | JSONB | default '{}', API 응답 등 원본 저장 |
| created_at | TIMESTAMPTZ | default now() |
| updated_at | TIMESTAMPTZ | default now() |

### 7.3 grant_announcements (공고 정규화)
| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | UUID | PK, default gen_random_uuid() |
| source_name | TEXT | NOT NULL, (source_name, source_ann_id) UNIQUE → **upsert 키** |
| source_ann_id | TEXT | NOT NULL |
| agency | TEXT | NOT NULL |
| title | TEXT | NOT NULL |
| max_amount | BIGINT | NOT NULL |
| url | TEXT | |
| **업력(월)** | | |
| min_age_months | INT | 최소 업력(월) |
| max_age_months | INT | 최대 업력(월) |
| **지역** | | |
| region_sido | TEXT[] | 시/도 목록 |
| region_sigungu | TEXT[] | 시/군/구 목록 |
| **업종** | | |
| industry_includes | TEXT[] | 대상 업종 |
| industry_excludes | TEXT[] | 제외 업종 |
| **금리/거치/상환** | | |
| interest_rate_min | NUMERIC(5,2) | |
| interest_rate_max | NUMERIC(5,2) | |
| grace_months | INT | 거치기간(월) |
| repay_months | INT | 상환기간(월) |
| **일정** | | |
| deadline_at | TIMESTAMPTZ | 신청 마감일 |
| published_at | TIMESTAMPTZ | 공고일 |
| target_criteria | JSONB | 레거시·유연 필드 |
| interest_rate | NUMERIC(5,2) | 단일 금리(호환) |
| grace_period_months | INT | 레거시 거치(호환) |
| created_at | TIMESTAMPTZ | default now() |
| updated_at | TIMESTAMPTZ | default now() |

**Upsert**: `INSERT ... ON CONFLICT (source_name, source_ann_id) DO UPDATE SET ...` 로 동일 출처·동일 공고 ID 기준 갱신 가능.

인덱스: `user_profiles(biz_no)`, `user_profiles(company_name)`, `announcement_sources(source_name)`, `grant_announcements(source_name)`, `grant_announcements(agency)`, GIN(`target_criteria`), GIN(`industry_includes`), GIN(`region_sido`), `published_at`, `deadline_at`.  
RLS는 활성화되어 있으며, `schema.sql`에 **정책(DROP POLICY IF EXISTS + CREATE POLICY)** 이 포함되어 재실행 가능한 형태로 구성되어 있습니다.

**샘플 데이터**: `schema.sql` 하단에 기존 샘플 5건을 `announcement_sources` + `grant_announcements` 새 스키마로 변환·적재하는 INSERT 예시 포함. (새 스키마 적용 후 실행.)

---

## 8. 환경 변수

파일: **`.env.example`** (복사해 `.env.local`로 사용)

| 변수명 | 용도 |
|--------|------|
| NEXT_PUBLIC_SUPABASE_URL | Supabase 프로젝트 URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase anon key |
| SUPABASE_SERVICE_ROLE_KEY | 서버에서 upsert/저장용(서비스 롤) |
| BIZINFO_API_KEY | 기업마당(Bizinfo) 수집 |
| SMES_API_BASE_URL | 중소벤처24(SMES) API Base URL |
| SMES_EXT_PBLANC_API_KEY | 중소벤처24(SMES) 민간공고 목록 키 |
| KSTARTUP_API_BASE_URL | K-Startup API Base URL |
| KSTARTUP_API_KEY | K-Startup 수집 키 |
| KODIT_STATS_API_BASE_URL | KODIT 통계 API Base URL |
| KODIT_STATS_API_KEY | KODIT 통계 키 |
| KOREG_PRODUCT_API_BASE_URL | 재보증 상품 API Base URL |
| KOREG_PRODUCT_API_KEY | 재보증 상품 API 키 |
| OPENAI_API_KEY | LLM 파싱 |
| OPENAI_CHAT_MODEL | LLM 모델(선택) |
| NTS_BIZ_API_KEY | 국세청 사업자 상태조회 |
| NEXT_PUBLIC_APP_URL | (Electron exe 빌드용) 로드할 배포 URL |

현재 앱/매칭 로직은 이 env 없이도 동작합니다 (Supabase·외부 API 미사용 시).

---

## 9. 실행 및 빌드

```bash
# 의존성 설치
npm install

# 개발 서버 (기본 http://localhost:3000)
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 서버
npm start

# 린트
npm run lint
```

---

## 10. 확장 가이드 (다음 개발자가 할 일)

### 10.1 공고 데이터 실제 연동
- `lib/data/grants.ts`의 `getGrantAnnouncements()`에서:
  - Supabase `grant_announcements` 테이블 조회, 또는
  - 각 기관 Open API 호출 후 `GrantAnnouncement[]` 형태로 매핑
- 공공데이터포털·기관별 API 명세는 `docs/API_INTEGRATION.md` 참고.

### 10.2 기업 프로필 저장
- 폼 제출 시 `lib/supabase/client.ts`의 `supabase`로 `user_profiles`에 insert (env 설정 필요).

### 10.3 매칭 알고리즘 보강
- `lib/matching/algorithm.ts`에서 키워드 매칭 정밀도(동의어/유사어), 점수 배분, 인증 가점 룰을 고도화하거나,
  Supabase의 정규화 컬럼(업력/지역/금리/거치/상환 등)을 활용해 필터/정렬을 강화할 수 있습니다.

### 10.4 Open API 인증
- 외부에서 `/api/match` 호출 시 API KEY 검증 미들웨어 추가 시, `app/api/match/route.ts` 상단에서 Header 검사 후 401 반환 로직 추가.

---

## 11. 문서·참고 링크

- **README.md**: 프로젝트 소개, 실행 방법, 로드맵 요약.
- **docs/API_INTEGRATION.md**: 공공 API 연동 방법 및 본 서비스 Open API 사용 예시(curl 등).

---

*이 문서는 현재(Phase 1) 구현 범위 기준으로 작성되었습니다. DB·외부 API 연동이 추가되면 해당 섹션을 갱신하는 것을 권장합니다.*
