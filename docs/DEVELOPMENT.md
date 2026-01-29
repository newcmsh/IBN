# 정책자금 스마트 매칭 시스템 — 개발 문서

다른 개발자가 현재까지 진행된 코드를 이해하고 이어서 개발할 수 있도록 정리한 문서입니다.

---

## 1. 프로젝트 개요

### 1.1 목적
- **서비스**: 정책자금 지원 컨설팅용 앱/웹
- **대상**: 컨설팅 신청 기업(회사명, 매출, 직군 등 입력)
- **제공**: 예상 지원금(보수/기준/최대 3단계), 적합도 점수(0~100, 예상 가능성/적합도), 가장 유리한 지원 창구

### 1.2 핵심 기능 (현재 구현)
| 기능 | 설명 | 구현 위치 |
|------|------|------------|
| 기업 정보 입력 | 사업자번호(검증 1단계) + 회사명, 매출, 직군(업종), 설립일, 지역, 보유 인증 | `components/CompanyForm.tsx` |
| 사업자상태 검증 | 사업자번호 입력 후 "검증" → Mock Provider → 실패 시 수동 입력 계속 가능 | `POST /api/verify-biz`, `lib/verification/` |
| 매칭 API | 기업 정보로 지원 공고 매칭 결과 반환 (Open API) | `app/api/match/route.ts` |
| 예상 지원금(3단계) | 보수/기준/최대(매출 비율 0.25/0.35/0.5 cap 후 공고 한도 min) | `lib/matching/algorithm.ts` (calcAmountRange) |
| 적합도 점수(0~100) | 필수요건 Pass/Fail + 인증 가점. 외부 표시용(예상 가능성/적합도, 과거 '당선 확률'과 동일 지표) | `lib/matching/algorithm.ts` |
| 최적 창구 | 금리 낮은 순 → 거치기간 긴 순 정렬, 1건 추천 | `lib/matching/algorithm.ts` |
| 대시보드 UI | 총 예상 지원금(보수·기준·최대), 매칭 건수, 카드별 3단계 금액·적합도 | `components/Dashboard.tsx`, `MatchingCard.tsx` |

### 1.3 데이터 소스 (연동 예정)
현재는 **샘플 공고 5건**으로 동작합니다. 실제 연동 대상:  
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
│   ├── verification/         # 사업자상태 검증 (Mock Provider, 추후 홈택스/제공사 API)
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
| industryName | string | | 업종명/직군 (직관 입력) |
| industryCode | string | | KSIC 업종 코드 |
| estDate | string | | 설립일 (YYYY-MM-DD) |
| region | string | | 지역 (시/도) |
| certifications | string[] | | 벤처인증, 수출실적, 특허 등 |
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
| industries, excludeIndustries | string[] | 대상/제외 업종 |
| regions | string[] | 대상 지역 |
| requiredCerts | string[] | 필수 인증 (벤처 등) |

### 4.4 MatchResult (매칭 결과 1건)
| 필드 | 타입 | 설명 |
|------|------|------|
| announcement | GrantAnnouncement | 해당 공고 |
| expectedAmount | number | 예상 지원금 기준값(원). 레거시·요약용 |
| probability | number | 적합도 점수 0~100 (외부: 예상 가능성/적합도) |
| amountRange | AmountRange | 지원금 3단계: conservative(보수), base(기준), optimistic(최대) |
| reason | string | 유리한 이유 요약 |
| rank | number | 추천 순위 (금리·거치기간 기준) |

### 4.5 MatchingApiResponse (Open API 응답)
| 필드 | 타입 | 설명 |
|------|------|------|
| companyName | string | 요청한 회사명 |
| totalExpectedAmount | number | 매칭된 공고 예상 지원금 합계 |
| matchCount | number | 매칭 건수 |
| matches | MatchResult[] | 전체 매칭 목록 |
| bestMatch | MatchResult | 가장 유리한 창구 1건 |

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
| `evaluateCriteria(company, criteria)` | 필수 요건(업력, 매출, 업종, 지역) Pass/Fail 및 가점(bonus) 계산. 불일치 시 `pass: false` 반환. |
| `getYearsFromDate(estDate)` | 설립일로부터 현재까지 연수(업력) 계산. |
| `calcExpectedAmount(company, announcement)` | `min(공고 한도, 매출 × 0.25)` 로 예상 지원금(레거시) 계산. |
| `calcAmountRange(company, announcement)` | 지원금 3단계: conservative(매출×0.25), base(매출×0.35), optimistic(매출×0.5), 각각 공고 한도 cap. |
| `calcProbability(company, announcement)` | 조건 통과 시 기본 50 + 가점(지역·인증), 최대 100. 불통과 시 0. |
| `buildMatchResult(company, announcement)` | 단일 공고에 대해 매칭 가능하면 `MatchResult` 생성, 불가 시 `null`. |
| `runMatching(company, announcements)` | 전체 공고에 대해 매칭 후 **정렬**: 금리 낮은 순(오름차순) → 거치기간 긴 순(내림차순) → 확률 내림차순 → 예상지원금 내림차순. 각 결과에 `rank` 부여. null 처리: 금리 null·거치기간 null은 해당 기준에서 **맨 뒤**. |

**정렬 기준 및 null 처리 (runMatching)**

| 순서 | 필드 | 정렬 | null 시 처리 |
|------|------|------|----------------|
| 1 | `interestRate` | 오름차순 (금리 낮은 순) | `null` → `999` 사용 → **맨 뒤** |
| 2 | `gracePeriodMonths` | 내림차순 (거치기간 긴 순) | `null` → `-1` 사용 → **맨 뒤** |
| 3 | `probability` | 내림차순 (적합도 높은 순) | - |
| 4 | `expectedAmount` | 내림차순 (기준 금액 높은 순) | - |

코드 상 상수: `INTEREST_RATE_NULL_SENTINEL = 999`, `GRACE_PERIOD_NULL_SENTINEL = -1` (`lib/matching/algorithm.ts`).

**가점 규칙 (요약)**
- 지역 일치: +10
- 공고 필수 인증 보유: 건당 +5 (총 +15 상한)
- 공고에 필수 인증 없어도 기업이 보유 시: 벤처 +10, 수출 +15, 특허 +5

**업종 매칭**: `industryName` 또는 `industryCode`를 기준으로, 공고의 `industries`/`excludeIndustries`와 문자열 포함 여부로 비교 (대소문자 무시).

---

### 5.2 공고 데이터 — `lib/data/grants.ts`

**역할**: 매칭에 사용할 공고 목록을 반환합니다. 현재는 **하드코딩된 샘플 5건**만 사용합니다.

**제공**
- `SAMPLE_ANNOUNCEMENTS`: GrantAnnouncement[] (중진공, 소진공, 신보, K-Startup, NTIS 예시)
- `getGrantAnnouncements()`: `Promise<GrantAnnouncement[]>`  
  - 현재: `SAMPLE_ANNOUNCEMENTS` 그대로 반환  
  - 추후: Supabase `grant_announcements` 조회 또는 각 기관 Open API 병렬 호출 후 정규화해 반환하도록 교체

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
| industryName | string | | 직군/업종 |
| industryCode | string | | KSIC 코드 |
| estDate | string | | 설립일 YYYY-MM-DD |
| region | string | | 지역 |
| certifications | string[] | | 보유 인증 배열 |

**응답 (200)**
- `MatchingApiResponse` 형태: `companyName`, `totalExpectedAmount`, `matchCount`, `matches`, `bestMatch`

**에러**
- 400: `companyName` 또는 `revenue` 누락 시 `{ error: "companyName, revenue 필수입니다." }`
- 500: 예외 시 `{ error: "매칭 처리 중 오류가 발생했습니다." }`

**처리 흐름**
1. Body 파싱 → `CompanyProfile` 형태로 정규화
2. `getGrantAnnouncements()` 로 공고 목록 조회
3. `runMatching(company, announcements)` 호출
4. `totalExpectedAmount`, `bestMatch`(첫 번째 결과) 계산 후 JSON 반환

---

## 6. UI 컴포넌트

### 6.1 메인 페이지 — `app/page.tsx`

- **역할**: 화면 전체 구성. 왼쪽에 기업 정보 폼, 오른쪽에 결과(또는 안내 문구/에러).
- **상태**: `result`(매칭 결과), `loading`, `error`
- **흐름**: `CompanyForm`에서 제출 → `handleSubmit`에서 `POST /api/match` 호출 → 성공 시 `Dashboard`에 `result` 전달, 실패 시 `error` 표시.
- **폼 → API 변환**: `revenue`는 정수로 파싱, `certifications`는 쉼표 구분 문자열을 배열로 변환해 전달.

### 6.2 CompanyForm — `components/CompanyForm.tsx`

- **역할**: 기업 정보 입력 폼. **1단계**: 사업자번호 입력 + "검증" 버튼으로 사업자상태 검증 후, 회사명·매출 등 입력.
- **Props**: `onSubmit(data: CompanyFormData)`, `loading?: boolean`
- **CompanyFormData**: `bizNo`, `companyName`, `revenue`, `industryName`, `estDate`, `region`, `certifications` (모두 문자열, 제출 시 상위에서 변환).
- **검증 흐름**: "검증" 클릭 → `POST /api/verify-biz` 호출 → 성공(active) 시 안내, 실패(휴폐업/미확인) 시 메시지 + "수동 입력으로 계속 진행할 수 있습니다." 표시. 수동 입력은 항상 가능.
- **UI**: Tailwind로 레이블·입력·검증 버튼·결과 메시지·제출 버튼 스타일링.

### 6.3 Dashboard — `components/Dashboard.tsx`

- **역할**: `MatchingApiResponse`를 받아 요약 + “가장 유리한 창구” + 전체 매칭 카드 그리드 표시.
- **표시 내용**: 회사명, 총 예상 지원금(기준) 및 보수·기준·최대 합계, 매칭 건수, 적합도(예상 가능성/적합도) 안내, bestMatch 1건, matches 그리드(반응형 2~3열, 카드별 3단계 금액·적합도 점수).

### 6.4 MatchingCard — `components/MatchingCard.tsx`

- **역할**: 매칭 1건 카드. 기관명, 공고 제목, 예상 지원금(보수 · 기준 · 최대) 3단계, 적합도 점수(0~100, 예상 가능성/적합도), 금리(있을 경우), 유리한 이유(reason).
- **Props**: `match: MatchResult`, `rank?: number`
- **금액 표시**: 1억 이상은 “N억”, 1만 이상은 “N만” 등으로 포맷 (`formatAmount`).

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
RLS는 활성화만 되어 있으며, 정책은 별도 정의 필요.

**샘플 데이터**: `schema.sql` 하단에 기존 샘플 5건을 `announcement_sources` + `grant_announcements` 새 스키마로 변환·적재하는 INSERT 예시 포함. (새 스키마 적용 후 실행.)

---

## 8. 환경 변수

파일: **`.env.example`** (복사해 `.env.local`로 사용)

| 변수명 | 용도 |
|--------|------|
| NEXT_PUBLIC_SUPABASE_URL | Supabase 프로젝트 URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase anon key |
| BIZINFO_API_KEY | 기업마당 등 (연동 시 사용) |
| KOSBI_API_KEY | 중진공 |
| SBC_API_KEY | 소진공 |
| KIBO_API_KEY | 신용보증기금 |
| KODIT_API_KEY | 신용보증재단 |
| KIBO_TECH_API_KEY | 기술보증기금 |
| KSTARTUP_API_KEY | K-Startup |
| NTIS_API_KEY | NTIS R&D |
| MOEL_API_KEY | 고용노동부 |
| KOTRA_API_KEY | 코트라 |
| KITA_API_KEY | 한국무역협회 |
| HOMETAX_API_KEY, NICE_BIZ_API_KEY | 사업자/기업 정보 연동용 |

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
- `lib/matching/algorithm.ts`에서 업종 매칭을 KSIC 코드 기반으로 세분화하거나, LLM으로 공고문에서 추출한 조건과 매칭하는 단계 추가 가능.

### 10.4 Open API 인증
- 외부에서 `/api/match` 호출 시 API KEY 검증 미들웨어 추가 시, `app/api/match/route.ts` 상단에서 Header 검사 후 401 반환 로직 추가.

---

## 11. 문서·참고 링크

- **README.md**: 프로젝트 소개, 실행 방법, 로드맵 요약.
- **docs/API_INTEGRATION.md**: 공공 API 연동 방법 및 본 서비스 Open API 사용 예시(curl 등).

---

*이 문서는 현재(Phase 1) 구현 범위 기준으로 작성되었습니다. DB·외부 API 연동이 추가되면 해당 섹션을 갱신하는 것을 권장합니다.*
