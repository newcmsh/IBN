# 정책자금 스마트 매칭 시스템 — 총 작업 내역 정리

지금까지 요청·반영된 개발 작업을 전부 정리한 문서입니다.

---

## 1. 프로젝트 초기 구성

### 1.1 목적·기능
- **서비스**: 정책자금 지원 컨설팅용 앱/웹
- **대상**: 컨설팅 신청 기업(회사명, 매출, 직군 등 입력)
- **제공**: 예상 지원금(보수/기준/최대 3단계), 적합도 점수(0~100, 예상 가능성/적합도), 가장 유리한 지원 창구
- **Open API**: 외부에서 `POST /api/match`로 매칭 결과 조회 가능

### 1.2 기술 스택·설정
- **Framework**: Next.js 14 (App Router), React 18, Tailwind CSS 3, TypeScript 5
- **Backend**: Next.js API Routes, (선택) Supabase (PostgreSQL, Auth)
- **설정 파일**: `next.config.js`, `tailwind.config.js`, `tsconfig.json`, `postcss.config.js` (경로 별칭 `@/*`)

### 1.3 구현된 핵심
- **타입** (`lib/types.ts`): `CompanyProfile`, `GrantAnnouncement`, `TargetCriteria`, `MatchResult`, `MatchingApiResponse`, `DataSource`
- **매칭 알고리즘** (`lib/matching/algorithm.ts`): 지원금 3단계(보수/기준/최대) `calcAmountRange`, 적합도 점수(0~100, 예상 가능성/적합도) 필수요건 Pass/Fail + 가점, 최적 창구 정렬
- **매칭 API** (`app/api/match/route.ts`): `POST /api/match` — Body `companyName`, `revenue`, `industryName` 등 → `MatchingApiResponse` 반환
- **공고 데이터** (`lib/data/grants.ts`): 샘플 공고 5건(중진공, 소진공, 신보, K-Startup, NTIS), `getGrantAnnouncements()` — 추후 Supabase/실제 API 연동
- **UI**: `CompanyForm`(기업 정보 입력), `Dashboard`(총 예상 지원금 보수·기준·최대, 매칭 건수), `MatchingCard`(예상 지원금 3단계·적합도 점수·금리·유리한 이유)
- **메인 페이지** (`app/page.tsx`): 왼쪽 폼, 오른쪽 결과/안내; 폼 제출 → `/api/match` 호출 → 결과 표시

### 1.4 추가·수정된 파일 (초기)
| 파일 | 내용 |
|------|------|
| `package.json` | Next.js 14, React 18, Tailwind, TypeScript, @supabase/supabase-js |
| `app/layout.tsx`, `app/globals.css`, `app/page.tsx` | 레이아웃, 전역 스타일, 메인 페이지 |
| `app/api/match/route.ts` | POST /api/match (매칭 Open API) |
| `components/CompanyForm.tsx`, `Dashboard.tsx`, `MatchingCard.tsx` | 기업 정보 폼, 대시보드, 매칭 카드 |
| `lib/types.ts` | 공통 타입 정의 |
| `lib/matching/algorithm.ts` | 매칭 엔진 (예상금·확률·정렬) |
| `lib/data/grants.ts` | 샘플 공고 5건, getGrantAnnouncements() |
| `lib/supabase/client.ts` | Supabase 클라이언트 (env 없으면 null) |
| `supabase/schema.sql` | user_profiles, grant_announcements (초기 스키마) |
| `.env.example` | Supabase·공공 API 키 템플릿 |
| `docs/DEVELOPMENT.md` | 개발 문서 (타입·API·UI·DB·확장 가이드) |
| `docs/API_INTEGRATION.md` | 공공 API 연동·매칭 Open API 사용법 |

---

## 2. 개발 문서화 (다른 개발자용)

- **문서**: `docs/DEVELOPMENT.md` — 현재까지 구현된 코드를 다른 개발자가 이해할 수 있도록 정리
- **포함 내용**: 프로젝트 개요, 기술 스택·의존성, 디렉터리 구조, 데이터 모델(타입), 핵심 모듈(매칭 알고리즘·공고 데이터·매칭 API), UI 컴포넌트, DB 스키마, 환경 변수, 실행·빌드, 확장 가이드
- **코드 기준**: 어떤 코드를 사용했는지, 타입·함수·API 스펙·정렬 규칙·null 처리 등 명시

---

## 3. 매칭 정렬 규칙 및 null 처리

### 3.1 정렬 순서 (기획 반영)
- **순서**: 금리 낮은 순(오름차순) → 거치기간 긴 순(내림차순) → 확률 내림차순 → 예상지원금 내림차순
- **구현**: `lib/matching/algorithm.ts`의 `runMatching()` 내부 `sort` 로직

### 3.2 null 처리
- **금리(null)**: `INTEREST_RATE_NULL_SENTINEL = 999` → 해당 기준에서 **맨 뒤**
- **거치기간(null)**: `GRACE_PERIOD_NULL_SENTINEL = -1` → 해당 기준에서 **맨 뒤**

### 3.3 추가·수정된 파일
| 파일 | 내용 |
|------|------|
| `lib/matching/algorithm.ts` | 상수 추가, 정렬 주석·순서 명시, null 처리 상수 사용 |
| `docs/DEVELOPMENT.md` | 정렬 기준 및 null 처리 표·설명 추가 |

---

## 4. 데이터베이스 스키마 확장 (공고 표준 스키마)

### 4.1 announcement_sources (원문 저장)
- **역할**: API 수집 Raw 데이터 저장
- **유니크**: `(source_name, source_ann_id)`
- **컬럼**: `id`, `source_name`, `source_ann_id`, `raw_payload`(JSONB), `created_at`, `updated_at`

### 4.2 grant_announcements (정규화 확장)
- **PK**: `id` (UUID)
- **Upsert 키**: `(source_name, source_ann_id)` UNIQUE
- **추가된 정규화 컬럼**:
  - 업력(월): `min_age_months`, `max_age_months`
  - 지역: `region_sido`(TEXT[]), `region_sigungu`(TEXT[])
  - 업종: `industry_includes`(TEXT[]), `industry_excludes`(TEXT[])
  - 금리/거치/상환: `interest_rate_min`, `interest_rate_max`, `grace_months`, `repay_months`
  - 일정: `deadline_at`, `published_at`
- **레거시 유지**: `target_criteria`(JSONB), `interest_rate`, `grace_period_months`

### 4.3 샘플 데이터 예시 SQL
- **announcement_sources**: kosbi/sbc/kibo/kstartup/ntis 5건 `raw_payload` INSERT + `ON CONFLICT DO UPDATE`
- **grant_announcements**: 위 5건을 정규화 컬럼으로 변환해 INSERT + `ON CONFLICT (source_name, source_ann_id) DO UPDATE`

### 4.4 추가·수정된 파일
| 파일 | 내용 |
|------|------|
| `supabase/schema.sql` | announcement_sources 테이블, grant_announcements 정규화 컬럼·유니크, 샘플 INSERT 예시 |
| `docs/DEVELOPMENT.md` | §7 데이터베이스 스키마에 announcement_sources·grant_announcements 정규화 스키마·upsert 설명 반영 |

---

## 5. RLS 정책

### 5.1 정책 대상·적용 순서
1. **user_profiles**: `auth.uid() = id` 인 사용자만 SELECT / INSERT / UPDATE 가능 (DELETE 정책 없음 — 서버 전용)
2. **matching_results, notifications, company_verifications, company_data_sources**: `user_id = auth.uid()` 인 행만 SELECT 가능; INSERT/UPDATE/DELETE 정책 없음(서버 전용)
3. **grant_announcements, announcement_sources**: 로그인 사용자(authenticated)는 SELECT 가능(읽기 전용); INSERT/UPDATE/DELETE 정책 없음(서버 전용)

### 5.2 신규 테이블 (RLS 대상)
- **matching_results**: `user_id`, `payload`(JSONB)
- **notifications**: `user_id`, `payload`, `read_at`
- **company_verifications**: `user_id`, `payload`
- **company_data_sources**: `user_id`, `payload`  
각 테이블 `user_id` → `auth.users(id)` FK, RLS 활성화 후 위 정책 적용

### 5.3 추가·수정된 파일
| 파일 | 내용 |
|------|------|
| `supabase/schema.sql` | §4 RLS 정책 대상 테이블 4개 CREATE, §5 RLS 활성화, §6 CREATE POLICY (적용 순서 주석 포함) |
| `docs/DEVELOPMENT.md` | §7에 RLS·announcement_sources·grant_announcements 스키마 설명 반영 |

---

## 6. 기업마당(Bizinfo) 수집 파이프라인

### 6.1 구현 선택
- **Next.js Route Handler** (`GET /api/ingest/bizinfo`) 권장
- **이유**: `BIZINFO_API_KEY`를 서버 `process.env`로만 사용 → 클라이언트 노출 없음, 같은 레포에서 배포·로깅·스케줄 연동 용이

### 6.2 동작
- Bizinfo 지원사업 API 호출 (요청 시 `type=json` 우선, 응답이 XML이면 파싱)
- **원문** → `announcement_sources` upsert (`source_name=bizinfo`, `source_ann_id`, `raw_payload`)
- **1차 매핑** → `grant_announcements` upsert (`title`, `agency`, `url`, `published_at`, `deadline_at`, `max_amount` 등)

### 6.3 환경 변수 (서버 전용)
- `BIZINFO_API_KEY` (필수)
- `BIZINFO_API_BASE_URL` (선택)
- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (DB 저장 시)

### 6.4 추가·수정된 파일
| 파일 | 내용 |
|------|------|
| `app/api/ingest/bizinfo/route.ts` | GET /api/ingest/bizinfo — API 호출, JSON/XML 파싱, announcement_sources·grant_announcements upsert |
| `lib/ingest/bizinfo.ts` | extractItemsFromResponse, normalizeItem, toSourceAnnId, SOURCE_NAME |
| `lib/ingest/parseResponse.ts` | parseApiResponse (JSON/XML 판별, fast-xml-parser로 XML 파싱) |
| `lib/supabase/admin.ts` | supabaseAdmin (SUPABASE_SERVICE_ROLE_KEY, RLS 우회) |
| `package.json` | fast-xml-parser 의존성 추가 |
| `.env.example` | SUPABASE_SERVICE_ROLE_KEY, BIZINFO_API_BASE_URL 설명 추가 |
| `docs/API_INTEGRATION.md` | 기업마당 수집 파이프라인, 로컬 실행 방법, curl 예시 추가 |

### 6.5 테스트 방법
- 로컬: `.env.local`에 `BIZINFO_API_KEY`, Supabase URL·서비스 롤 키 설정 → `npm run dev` → `curl -s -X GET "http://localhost:3000/api/ingest/bizinfo" | jq .`

---

## 7. 공고 원문 파싱 모듈 (LLM → 표준 스키마)

### 7.1 목적
- `announcement_sources`의 원문(또는 상세 본문 텍스트)을 입력으로, **표준 스키마(업력/업종/지역/한도/금리/거치/상환) + target_criteria(JSONB)** 생성

### 7.2 추상화·규칙
- **진입점**: `parseWithLLM(text): Promise<ParsedAnnouncement | null>` — LLM 호출은 이 함수로만 수행
- **키**: `OPENAI_API_KEY` 등은 **서버** `process.env`에서만 읽음
- **프롬프트**: "반드시 JSON만 출력, 누락은 null 허용, 단위(월/년/원/%/개월) 명시" (`lib/parsing/prompt.ts`)

### 7.3 배치·트리거
- **배치 함수**: `batchParseAndUpsert(entries, supabaseAdmin)` — 원문 목록 파싱 후 `grant_announcements` upsert
- **원문 추출**: `extractTextFromRawPayload(raw_payload)` — content/body/detail/본문 등 우선, 없으면 JSON 문자열
- **트리거 API**: `GET /api/ingest/parse?source_name=bizinfo` — announcement_sources 조회 후 배치 파싱·upsert

### 7.4 추가·수정된 파일
| 파일 | 내용 |
|------|------|
| `lib/parsing/types.ts` | ParsedAnnouncement (표준 스키마 + target_criteria) |
| `lib/parsing/prompt.ts` | PARSING_SYSTEM_PROMPT, buildParsingPrompt (단위·JSON 규칙) |
| `lib/parsing/parseWithLLM.ts` | parseWithLLM, extractJsonFromLLMResponse, normalizeParsed, OpenAI 구현(서버 전용) |
| `lib/parsing/batch.ts` | batchParseAndUpsert, extractTextFromRawPayload, toGrantAnnouncementRow |
| `lib/parsing/index.ts` | 타입·함수 re-export |
| `app/api/ingest/parse/route.ts` | GET /api/ingest/parse — announcement_sources 조회 → 배치 파싱 → grant_announcements upsert |
| `.env.example` | OPENAI_API_KEY, OPENAI_CHAT_MODEL |
| `docs/API_INTEGRATION.md` | 공고 원문 파싱(LLM→표준 스키마) 섹션 추가 |
| `docs/DEVELOPMENT.md` | lib/parsing 디렉터리·파일 설명 추가 |

---

## 8. 기업 온보딩 1단계: 사업자상태 검증

### 8.1 CompanyForm 변경
- **사업자번호(bizNo)** 필드 추가 (맨 위, 회사명 위)
- **"검증" 버튼**: 클릭 시 `POST /api/verify-biz` 호출
- **결과 표시**:
  - 성공(active): 초록색 메시지
  - 실패(휴·폐업/미확인): 주황색 메시지 + **"수동 입력으로 계속 진행할 수 있습니다."** 안내
- 검증 실패 여부와 관계없이 **회사명·매출 등 수동 입력 및 제출은 항상 가능**
- `CompanyFormData`에 `bizNo` 포함, 매칭 API로 전달 시 `bizNo`도 함께 전송

### 8.2 API: POST /api/verify-biz
- **Body**: `{ bizNo: string }`
- **동작**:
  - 사업자번호 정규화(숫자 10자리) 후 **Mock Provider**로 검증
  - **결과**: `{ status, message, bizNo, verifiedAt, saved? }`
  - **로그인 사용자** (`Authorization: Bearer <supabase_jwt>` 있음): `company_verifications`에 `user_id`, `payload: { bizNo, status, message, verifiedAt }` 저장 → `saved: true` 반환
  - 비로그인: 검증 결과만 반환, 저장 안 함

### 8.3 Mock Provider (lib/verification/bizProvider.ts)
- **인터페이스**: `BizVerificationProvider` — `verifyBizStatus(bizNo): Promise<VerifyBizResult>`
- **반환**: `{ status: 'active' | 'closed' | 'unknown', message: string, verifiedAt?: string }`
- **Mock 규칙**:
  - 10자리 아님 → `unknown`
  - 10자리 중 `000`으로 시작 또는 `1111111111` → `closed` (휴·폐업 안내)
  - 그 외 10자리 → `active`
- 실제 홈택스/제공사 API 연동 시 동일 인터페이스를 구현한 Provider로 교체

### 8.4 추가·수정된 파일
| 파일 | 내용 |
|------|------|
| `lib/verification/bizProvider.ts` | BizStatus, VerifyBizResult, BizVerificationProvider, normalizeBizNo, isValidBizNoFormat, mockBizProvider |
| `lib/verification/index.ts` | 위 타입·함수 re-export |
| `app/api/verify-biz/route.ts` | POST /api/verify-biz — Mock 검증 + (로그인 시) company_verifications 저장 |
| `components/CompanyForm.tsx` | bizNo 필드, 검증 버튼, 검증 상태/메시지, 실패 시 수동 입력 안내 |
| `app/page.tsx` | 매칭 API 요청 시 bizNo 포함 |
| `docs/DEVELOPMENT.md` | 온보딩 검증 흐름, CompanyForm·디렉터리 구조 반영 |

### 8.5 테스트 방법
- **정상(active)**: 사업자번호 10자리 입력 (예: 1234567890) → "검증" → "사업자상태가 정상으로 확인되었습니다."
- **휴·폐업(closed)**: 0001234567 또는 1111111111 → "휴·폐업 상태로 확인되었습니다. 수동 입력으로 계속 진행할 수 있습니다."
- **형식 오류(unknown)**: 9자리 이하 등 → "사업자번호는 10자리 숫자입니다. 형식을 확인해 주세요." + 수동 입력 안내
- 어떤 경우든 회사명·매출 등 입력 후 **"매칭 결과 보기"** 로 제출 가능

---

## 9. MatchResult 확장: 적합도 점수 + 지원금 3단계

### 9.1 외부 표시용 명칭
- **probability**: 외부 표시용으로 **"적합도 점수(0~100)"** 로 명명. 문서·UI에서 **"예상 가능성/적합도"** 로 설명 문구 추가 (과거 '당선 확률'과 동일 지표).
- **expectedAmount**: 기준값 유지(레거시·요약용). 상세 금액은 **amountRange** 사용.

### 9.2 지원금 3단계(range)
- **algorithm.ts**: `calcAmountRange(company, announcement)` 추가 → `{ conservative, base, optimistic }` 반환.
- **비율**: 보수적 0.25, 기준 0.35, 최대 0.5 (매출 대비). 각각 공고 한도 cap 후 반환.
- **MatchResult**: `amountRange: AmountRange` 필드 추가. `expectedAmount`는 `amountRange.base`와 동일.

### 9.3 UI 표시
- **MatchingCard**: 예상 지원금을 "보수 · 기준 · 최대" 3단계로 표시. 적합도는 "적합도 점수" 라벨로 표시.
- **Dashboard**: 총 예상 지원금(기준) + 보수·기준·최대 합계 라인. "적합도는 예상 가능성/적합도 점수(0~100)" 안내 문구.

### 9.4 추가·수정된 파일
| 파일 | 내용 |
|------|------|
| `lib/types.ts` | AmountRange 타입, MatchResult.amountRange 추가, probability/expectedAmount 주석(적합도·기준값) |
| `lib/matching/algorithm.ts` | calcAmountRange, REVENUE_CAP_RATIO_BASE/OPTIMISTIC, buildMatchResult에 amountRange 반영 |
| `components/MatchingCard.tsx` | 3단계 금액(보수·기준·최대), 적합도 점수 라벨 |
| `components/Dashboard.tsx` | 총 지원금 보수·기준·최대 합계, 적합도 설명 문구 |
| `docs/DEVELOPMENT.md` | 예상 지원금(3단계), 적합도 점수(예상 가능성/적합도), amountRange·calcAmountRange 설명 |
| `docs/API_INTEGRATION.md` | 응답에 amountRange, 적합도 설명 반영 |
| `docs/PROJECT_WORK_SUMMARY.md` | §1.3·§9 본 섹션 |

---

## 10. 추가·수정된 파일 총정리

| 구분 | 파일 | 내용 요약 |
|------|------|-----------|
| 앱 | `app/layout.tsx`, `app/globals.css`, `app/page.tsx` | 레이아웃, 전역 스타일, 메인 페이지(폼+결과) |
| API | `app/api/match/route.ts` | POST /api/match (매칭 Open API) |
| API | `app/api/verify-biz/route.ts` | POST /api/verify-biz (사업자상태 검증) |
| API | `app/api/ingest/bizinfo/route.ts` | GET /api/ingest/bizinfo (기업마당 수집) |
| API | `app/api/ingest/parse/route.ts` | GET /api/ingest/parse (원문→LLM 파싱 배치) |
| 컴포넌트 | `components/CompanyForm.tsx` | 기업 정보 입력(사업자번호·검증 포함) |
| 컴포넌트 | `components/Dashboard.tsx`, `MatchingCard.tsx` | 매칭 요약(3단계 금액·적합도)·카드 UI |
| lib | `lib/types.ts` | CompanyProfile, GrantAnnouncement, MatchResult, AmountRange 등 |
| lib | `lib/matching/algorithm.ts` | 매칭 엔진(지원금 3단계 calcAmountRange·적합도·정렬·null 처리) |
| lib | `lib/data/grants.ts` | 샘플 공고, getGrantAnnouncements() |
| lib | `lib/verification/bizProvider.ts`, `index.ts` | 사업자상태 검증 Mock Provider·인터페이스 |
| lib | `lib/ingest/bizinfo.ts`, `parseResponse.ts` | Bizinfo 응답 추출·JSON/XML 파싱 |
| lib | `lib/parsing/types.ts`, `prompt.ts`, `parseWithLLM.ts`, `batch.ts`, `index.ts` | 원문→LLM 파싱·표준 스키마·배치 upsert |
| lib | `lib/supabase/client.ts`, `admin.ts` | Supabase 클라이언트(anon), Admin(서비스 롤) |
| DB | `supabase/schema.sql` | user_profiles, announcement_sources, grant_announcements(정규화), RLS 대상 4테이블, RLS 정책, 샘플 INSERT |
| 설정 | `package.json`, `tsconfig.json`, `next.config.js`, `tailwind.config.js`, `postcss.config.js` | 의존성·TypeScript·Next·Tailwind 설정 |
| env | `.env.example` | Supabase, BIZINFO, OPENAI, SUPABASE_SERVICE_ROLE_KEY 등 |
| 문서 | `docs/DEVELOPMENT.md` | 개발 문서(전체 구조·타입·API·UI·DB·확장) |
| 문서 | `docs/API_INTEGRATION.md` | 공공 API 연동, Bizinfo 수집, LLM 파싱, 매칭 Open API, curl·로컬 실행 |
| 문서 | `docs/PROJECT_WORK_SUMMARY.md` | 본 문서(총 작업 내역) |

---

## 11. 실행·테스트 요약

### 11.1 로컬 실행
```bash
npm install
# .env.local 설정 (선택: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, BIZINFO_API_KEY, OPENAI_API_KEY, SUPABASE_SERVICE_ROLE_KEY 등)
npm run dev
```
- 브라우저: http://localhost:3000 — 사업자번호(검증) → 회사명·매출·직군 등 입력 → "매칭 결과 보기"

### 11.2 API 테스트 (curl 예시)
- 매칭: `curl -X POST http://localhost:3000/api/match -H "Content-Type: application/json" -d '{"companyName":"(주)테스트","revenue":500000000,"industryName":"제조업"}'`
- 사업자 검증: `curl -X POST http://localhost:3000/api/verify-biz -H "Content-Type: application/json" -d '{"bizNo":"1234567890"}'`
- Bizinfo 수집: `curl -s -X GET "http://localhost:3000/api/ingest/bizinfo" | jq .`
- 원문 파싱 배치: `curl -s -X GET "http://localhost:3000/api/ingest/parse?source_name=bizinfo" | jq .`

---

*이 문서는 요청·반영된 작업을 기준으로 정리되었습니다. 세부 코드는 각 파일과 `docs/DEVELOPMENT.md`를 참고하세요.*
