# IBN 정책자금 스마트 매칭 — 전체 작업 개요

**누구나 쉽게** “무슨 서비스인지, 어떤 코드로 어떻게 만들었는지” 한눈에 알 수 있도록 정리한 문서입니다.

---

## 1. 이 서비스가 하는 일 (한 줄 요약)

- **대상**: 정책자금 지원이 필요한 중소기업·소상공인을 상담하는 **내부 상담원**
- **입력**: 상담받는 기업 정보(회사명, 매출, 업태, 종목, 설립일, 주소, 인증·감점 여부 등)
- **출력**: 해당 기업에 **추천되는 지원 공고**와 **탈락 공고** 목록, **예상 지원금(보수/기준/최대)**, **적합도 점수·사유**

---

## 2. 사용 기술과 폴더 구조

### 2.1 기술 스택

| 구분 | 사용 기술 |
|------|-----------|
| 프론트 | Next.js 14 (App Router), React 18, Tailwind CSS 3, TypeScript 5 |
| 백엔드 | Next.js API Routes, Supabase (PostgreSQL, Auth) |
| 배포 | Vercel(웹), Electron(Windows exe — 내부 PC용) |

### 2.2 프로젝트 폴더 구조 (핵심만)

```
IBN/
├── app/                          # Next.js 페이지·API
│   ├── page.tsx                  # 메인(폼 + 매칭 결과)
│   ├── layout.tsx                # 전역 레이아웃·CSS
│   ├── login/, signup/, pending/  # 로그인·회원가입·승인대기
│   ├── admin/approvals/           # 관리자 — 회원가입 승인·전체 회원 목록
│   └── api/                       # API 라우트
│       ├── match/                 # POST /api/match (매칭)
│       ├── verify-biz/            # POST /api/verify-biz (사업자 검증)
│       ├── admin/approvals/       # GET/POST 회원 목록·승인/반려
│       ├── admin/me/              # GET 관리자 여부 확인
│       ├── auth/signup/           # POST 회원가입
│       └── ingest/                # 공고 수집(bizinfo, smes, kstartup 등)·parse(LLM)
├── components/                   # UI 컴포넌트
│   ├── CompanyForm.tsx            # 기업 정보 입력 폼
│   ├── AddressSearchModal.tsx     # 우편번호 검색(다음/카카오)
│   ├── Dashboard.tsx              # 매칭 요약·추천/탈락 탭
│   └── MatchingCard.tsx           # 공고 1건 카드
├── lib/                           # 공통 로직
│   ├── types.ts                   # 타입 정의(CompanyProfile, MatchResult 등)
│   ├── matching/algorithm.ts      # 매칭 엔진(점수·탈락·정렬)
│   ├── data/grants.ts             # 공고 데이터(Supabase 또는 샘플)
│   ├── verification/               # 사업자 검증(국세청 OpenAPI 등)
│   ├── parsing/                   # LLM으로 공고 원문 → 표준 스키마
│   ├── ingest/                    # bizinfo, smes, kstartup 등 수집
│   ├── utils/                     # 날짜·금액·URL 유틸
│   └── supabase/                  # Supabase 클라이언트(브라우저·서버·Admin)
├── supabase/schema.sql            # DB 테이블·RLS 정책
├── electron/main.ts               # Electron exe 진입점
└── docs/                          # 문서
```

---

## 3. 기능별로 “어떤 코드”를 “어떻게” 썼는지

### 3.1 로그인·회원가입·승인 흐름

| 기능 | 설명 | 사용한 코드(파일) |
|------|------|-------------------|
| 로그인 | 이메일/비밀번호 로그인 | `app/login/LoginClient.tsx` — Supabase `signInWithPassword` |
| 회원가입 | 이름·이메일·전화·회사·주소·비밀번호 입력 | `app/signup/SignupClient.tsx` — Supabase `signUp` + `app/api/auth/signup/route.ts`에서 `consultant_profiles`에 pending으로 저장 |
| 승인 대기 | 가입 후 운영자 승인 전까지 | `app/pending/pendingClient.tsx` — middleware에서 `consultant_profiles.status !== 'approved'`면 `/pending`으로 리다이렉트 |
| 관리자 판별 | 특정 이메일만 관리자 | `middleware.ts` — `ADMIN_EMAILS` 환경변수로 관리자 이메일 목록, 관리자는 승인 없이 앱 접근·`/admin/*` 접근 가능 |
| 관리자 페이지 | 회원 목록(대기/승인/반려/전체)·승인/반려 처리 | `app/admin/approvals/ApprovalsClient.tsx` — 탭으로 status 필터, `GET/POST /api/admin/approvals` 사용 |

**DB**: `consultant_profiles` 테이블 (`supabase/schema.sql`) — `user_id`, `email`, `full_name`, `phone`, `company_name`, `address`, `status`(pending/approved/rejected), `requested_at`, `approved_at`, `rejected_at`, `approved_by` 등.

---

### 3.2 기업 정보 입력 폼 (CompanyForm)

| 입력 항목 | 설명 | 사용한 코드 |
|-----------|------|-------------|
| 사업자번호 | 10자리 입력 후 “검증” 버튼 | `CompanyForm.tsx` — `POST /api/verify-biz` 호출, 결과 메시지 표시(실패해도 수동 입력 계속 가능) |
| 회사명·매출 | 회사명 텍스트, 매출은 쉼표 포맷 + 한글 금액 표시 | `lib/utils/koreanNumber.ts` — `formatRevenueDisplay`, `parseRevenueNumber`, `toKoreanWon` |
| 업태 | 제조/도소매/서비스 등 **복수 선택** 체크박스 | `CompanyForm.tsx` — `bizTypes: string[]` 상태 |
| 종목·키워드 | 태그 입력(Enter/쉼표로 추가), 종목 추가 시 키워드에 자동 반영 | `CompanyForm.tsx` — `items[]`, `industryKeywords[]` |
| 설립일 | 연/월/일 드롭다운(한글) | `CompanyForm.tsx` — `estDate` (YYYY-MM-DD), 3칸 그리드로 표시 |
| 주소 | 우편번호 검색 → 기본주소 자동 채움, 상세주소 직접 입력 | `components/AddressSearchModal.tsx` — 다음(카카오) 우편번호 스크립트, `zipcode`, `address1`, `address2`, `regionSido`/`regionSigungu`(address1에서 파싱) |
| 가점요소 | 인증/자격(벤처, 특허, ISO 등) — 대분류 아코디언 | `lib/constants/certifications.ts` + `CompanyForm.tsx` — `certifications: string[]` |
| 감점요소 | 결격/중대(하드)·리스크(감점) 체크박스 | `CompanyForm.tsx` — `penalties: PenaltyFlags` (타입은 `lib/types.ts`) |

제출 시 `app/page.tsx`에서 `POST /api/match`로 위 데이터를 보냅니다.

---

### 3.3 매칭 API와 알고리즘

| 단계 | 설명 | 사용한 코드 |
|------|------|-------------|
| API 진입 | POST /api/match, Body에 기업 정보 | `app/api/match/route.ts` — `companyName`, `revenue`, `bizType`, `items`, `industryKeywords`, `estDate`, `zipcode`/`address1`/`address2`, `regionSido`/`regionSigungu`, `certifications`, `penalties` 등 수신 |
| 공고 목록 조회 | DB 또는 샘플 | `lib/data/grants.ts` — `getGrantAnnouncements()`: Supabase `grant_announcements` 있으면 사용, 없으면 샘플 5건 |
| 단일 공고 평가 | 탈락 여부·점수·사유 계산 | `lib/matching/algorithm.ts` — `buildMatchResult(company, announcement)` |
| 하드 결격(감점) | 국세/지방세/4대보험 체납, 연체, 파산, 휴폐업 등 체크 시 즉시 탈락 | `lib/matching/algorithm.ts` — `calcPenalty()` → `hardFail`이면 `passed: false`, `rejectReasons` 반환 |
| 조건 필터 | 업태·제외키워드·업력·매출·지역 불일치 시 탈락 | `evaluateBaseCriteria()` — `allowed_biz_types`, `exclude_keywords`, 업력/매출/지역(`regionSido`/`regionSigungu` 사용) |
| 점수 계산 | 기본(0~70) + 인증 가점(최대 15) − 감점(최대 30) → 최종 0~100 | `buildMatchResult()` 내부 — `baseScore`, `calcCertBonusAndReasons()`, `penalty` 합산 |
| 추천 정렬 | 점수 내림차순 → 금리 오름차순 → 마감일 오름차순, rank 부여 | `runFullMatching()` — `recommended`/`rejected` 분리 후 정렬 |

**타입**: `lib/types.ts` — `CompanyProfile`, `GrantAnnouncement`, `TargetCriteria`, `MatchResult`, `MatchingApiResponse`, `PenaltyFlags` 등.

---

### 3.4 결과 화면 (Dashboard·MatchingCard)

| 기능 | 설명 | 사용한 코드 |
|------|------|-------------|
| 요약 | 총 예상 지원금(보수·기준·최대), 추천/탈락 건수 | `components/Dashboard.tsx` |
| 가장 유리한 창구 | 추천 1순위 1건 강조 | `Dashboard.tsx` — `bestMatch` |
| 추천/탈락 탭 | 추천 공고·탈락 공고 **전부** 표시(제한 없음) | `Dashboard.tsx` — 탭 전환, 리스트는 세로 1열 |
| 마감일 필터 | 전체 / 7일 이내 / 30일 이내 | `Dashboard.tsx` — `lib/utils/dates.ts`의 `getDDay()` 사용 |
| 지역 필터 | regionSido 있으면 “전체 / 우리 지역 대상 / 전국” 선택 | `Dashboard.tsx` — `filterByRegion()` |
| 카드 1건 | 순위, 점수, 신뢰도, 사유, 예상 지원금 3단계, 마감 D-day·기간, 바로보기 링크 | `components/MatchingCard.tsx` — 추천은 `scoreBreakdown`·`reasons`·`warnings`, 탈락은 `rejectReasons` 또는 `hardFailReasons` |
| URL 품질 | placeholder/예시 URL이면 “공고 바로가기” 버튼 숨김 | `lib/utils/url.ts` — `isPlaceholderUrl()` 등 |

---

### 3.5 사업자 상태 검증

| 단계 | 설명 | 사용한 코드 |
|------|------|-------------|
| API | POST /api/verify-biz, Body `{ bizNo }` | `app/api/verify-biz/route.ts` |
| 실제 연동 | 국세청 OpenAPI(사업자등록 진위·상태조회) | `lib/verification/ntsProvider.ts` — `BizVerificationProvider` 구현, 정상→active, 휴폐업→closed, 기타→unknown |
| 저장 | 로그인 사용자면 `company_verifications` 테이블에 저장 | `app/api/verify-biz/route.ts` — Supabase Admin 사용 |

---

### 3.6 공고 수집(Ingest)·LLM 파싱

| 대상 | 설명 | 사용한 코드 |
|------|------|-------------|
| 기업마당(Bizinfo) | GET /api/ingest/bizinfo | `app/api/ingest/bizinfo/route.ts`, `lib/ingest/bizinfo.ts` — 원문은 `announcement_sources`, 1차 매핑은 `grant_announcements`에 upsert |
| 중소벤처24(SMES) | GET /api/ingest/smes | `app/api/ingest/smes/route.ts`, `lib/ingest/smes.ts` |
| K-Startup | GET /api/ingest/kstartup | `app/api/ingest/kstartup/route.ts`, `lib/ingest/kstartup.ts` |
| KODIT 통계 | GET /api/ingest/kodit-stats | `app/api/ingest/kodit/stats/route.ts` — `announcement_sources`에만 저장(공고 아님) |
| KOREG 재보증 상품 | GET /api/ingest/koreg/products | `app/api/ingest/koreg/products/route.ts`, `lib/ingest/koregProducts.ts` |
| LLM 파싱 | 원문 → 표준 스키마(업력/지역/한도/금리 등) + target_criteria | GET /api/ingest/parse?source_name=bizinfo — `lib/parsing/parseWithLLM.ts`, `batch.ts`, OpenAI 사용 |

공통: 원문은 `(source_name, source_ann_id)` 기준으로 `announcement_sources`에 upsert, 공고성 데이터는 `grant_announcements`에 upsert. API 키는 서버 `process.env`에서만 읽고 로그에 노출하지 않습니다.

---

### 3.7 Electron(Windows exe)

| 항목 | 설명 | 사용한 코드 |
|------|------|-------------|
| 동작 방식 | exe는 **앱 코드를 담지 않고**, 배포 URL(Vercel)만 로드 | `electron/main.ts` — `getAppUrl()`에서 `electron-app-url.json` 또는 `NEXT_PUBLIC_APP_URL` 읽음, `app.isPackaged`로 개발/프로덕션 구분 |
| 빌드 | npm run electron:build | `package.json` — electron-builder, `scripts/write-app-url.js`로 URL 주입, `dist/` 아래 NSIS 설치 exe 생성 |
| 관리자 페이지 | exe에서 주소창 없이 접근 | `electron/main.ts` — 메뉴 “관리자 → 회원가입 승인관리 열기”(Ctrl+Shift+A) |
| 흰 화면 방지 | 스플래시 → URL 로드, 실패 시 안내 화면 | `electron/main.ts` — data URL 스플래시 후 `loadURL(appUrl)`, `did-fail-load` 시 에러 HTML 표시 |

자세한 빌드·트러블슈팅: `docs/ELECTRON_BUILD.md`

---

## 4. 데이터 모델 요약

### 4.1 타입 (`lib/types.ts`)

- **CompanyProfile**: 회사명, 매출, bizType[], items[], industryKeywords[], estDate, zipcode/address1/address2, regionSido/regionSigungu, certifications[], penalties(PenaltyFlags), bizNo 등.
- **PenaltyFlags**: taxArrears, localTaxArrears, fourInsArrears, inDefault, inRehabBankruptcy, businessClosed(하드), pastDefaultResolved, guaranteeAccidentResolved/Unresolved, highDebtSuspected(감점) 등.
- **GrantAnnouncement**: annId, agency, title, maxAmount, targetCriteria, interestRate, url, sourceUrl, publishedAt, startAt, deadlineAt 등.
- **TargetCriteria**: allowed_biz_types, include_keywords, exclude_keywords, regions, minRevenue/maxRevenue, minYears/maxYears 등.
- **MatchResult**: passed, score, confidence, reasons, rejectReasons, scoreBreakdown, flags(hardFail, hardFailReasons, warnings), announcement, expectedAmount, amountRange, rank 등.
- **MatchingApiResponse**: companyName, regionSido, regionSigungu, recommended, rejected, bestMatch, totalExpectedAmount, matchCount.

### 4.2 DB 테이블 (`supabase/schema.sql`)

- **consultant_profiles**: 회원가입·승인 (user_id, email, full_name, phone, company_name, address, status, requested_at, approved_at, rejected_at, approved_by 등).
- **announcement_sources**: 수집 원문 (source_name, source_ann_id, raw_payload).
- **grant_announcements**: 정규화된 공고 (agency, title, max_amount, target_criteria, region_sido, deadline_at 등).
- **user_profiles**, **matching_results**, **notifications**, **company_verifications**, **company_data_sources**: RLS로 본인/서버만 접근.

---

## 5. API 목록 (엔드포인트만 정리)

| 메서드 | 경로 | 용도 |
|--------|------|------|
| POST | /api/match | 기업 정보로 매칭 결과 반환 |
| POST | /api/verify-biz | 사업자번호 검증(국세청 연동) |
| POST | /api/auth/signup | 회원가입(consultant_profiles에 pending 저장) |
| GET | /api/admin/me | 관리자 여부(이메일 ∈ ADMIN_EMAILS) |
| GET | /api/admin/approvals?status=pending\|approved\|rejected\|all | 회원 목록 조회 |
| POST | /api/admin/approvals | 승인/반려 처리 (userId, action) |
| GET | /api/ingest/bizinfo | 기업마당 수집 |
| GET | /api/ingest/smes | 중소벤처24 수집 |
| GET | /api/ingest/kstartup | K-Startup 수집 |
| GET | /api/ingest/kodit-stats | KODIT 통계 수집 |
| GET | /api/ingest/koreg/products | KOREG 재보증 상품 수집 |
| GET | /api/ingest/parse?source_name=... | LLM 파싱 배치 |

---

## 6. 환경 변수 (운영 시 필요한 것)

- **Supabase**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **관리자**: `ADMIN_EMAILS` (쉼표 구분 이메일)
- **사업자 검증**: `NTS_BIZ_API_KEY`
- **공고 수집**: `BIZINFO_API_KEY`, `SMES_*`, `KSTARTUP_*`, `KODIT_*`, `KOREG_*` 등
- **LLM 파싱**: `OPENAI_API_KEY`
- **Electron exe**: `NEXT_PUBLIC_APP_URL` (Vercel 배포 URL)

자세한 목록: `.env.example`, `docs/DEVELOPMENT.md`

---

## 7. 실행·빌드·배포

```bash
# 설치
npm install

# 로컬 개발(웹)
npm run dev          # http://localhost:3000

# 로컬 개발(웹 + Electron)
npm run electron:dev

# 웹 프로덕션 빌드
npm run build
npm start

# Windows exe 빌드
# NEXT_PUBLIC_APP_URL 설정 후
npm run electron:build
# 결과: dist/ 아래 설치 exe
```

- **웹 배포**: Vercel 등에 연결 후 push 시 자동 배포. exe는 URL만 로드하므로 웹을 배포하면 exe 재설치 없이 최신 화면 반영 가능(단, exe 재실행 또는 “서버 다시 연결” 필요).

---

## 8. 참고 문서 (세부 사항)

| 문서 | 내용 |
|------|------|
| **docs/MATCHING_SCORE_AND_AMOUNT.md** | **적합도·예상지원금 구조** — 점수 구성(base/bonus/penalty), 추천 로직, 지원금 3단계 산식, 매출이 높을수록 지원금이 높아지는 이유 |
| **docs/DATA_PORTAL_INGEST.md** | **공공데이터포털 수집** — 데이터 수집 흐름, 코드 구조(API 호출·파싱·추출·정규화·DB 저장), 파일별 역할 |
| **docs/HANDOFF.md** | 인수인계용 — 매칭 규칙·타입·API 요약 |
| **docs/DEVELOPMENT.md** | 개발자용 — 타입·모듈·DB·확장 가이드 |
| **docs/PROJECT_WORK_SUMMARY.md** | 작업 내역 요약(기능별 파일·변경) |
| **docs/API_INTEGRATION.md** | 공공 API 연동·curl 예시 |
| **docs/ELECTRON_BUILD.md** | Electron exe 빌드·트러블슈팅 |

---

*이 문서는 프로젝트 전체 작업을 “어떤 코드로 어떻게 했는지” 쉽게 알 수 있도록 정리한 개요입니다. 세부 구현은 위 참고 문서와 실제 코드(`lib/types.ts`, `lib/matching/algorithm.ts`, `app/api/*` 등)를 함께 보시면 됩니다.*
