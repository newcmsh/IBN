# 정책자금 공공 API 연동 가이드

컨설팅용 앱/웹에서 **회사명, 매출, 직군** 입력 시 **예상 지원금(보수/기준/최대)·적합도 점수(0~100, 예상 가능성/적합도)·어디서 지원받는 게 유리한지**를 보여주기 위해, 아래 기관 Open API를 API KEY로 연동할 수 있습니다.

## 연동 대상 기관 (API KEY 사용)

| 기관 | 용도 | 비고 |
|------|------|------|
| **기업마당 (Bizinfo)** | 공고·정책 정보 수집 | 공공데이터포털 또는 기관별 API |
| **보조금24** | 보조금 공고 | 해당 서비스 API 정책 확인 |
| **중소벤처기업진흥공단 (중진공)** | 중소기업·벤처 지원 공고 | Open API 또는 공공데이터포털 |
| **소상공인시장진흥공단 (소진공)** | 소상공인 지원 공고 | 공공데이터포털 |
| **신용보증기금** | 보증·융자 공고 | 기관 API |
| **신용보증재단** | 보증 공고 | 기관 API |
| **기술보증기금** | 기술 보증·R&D | 기관 API |
| **K-Startup** | 벤처·스타트업 공고 | K-Startup API |
| **NTIS** | R&D 과제·지원 | NTIS Open API |
| **고용노동부** | 고용 지원금 | 공공데이터포털 |
| **코트라** | 수출·무역 지원 | 코트라 API |
| **한국무역협회** | 무역 지원 | 기관 API |

## Open API 사용 방식

1. **공공데이터포털 (data.go.kr)**  
   - 많은 정책·공고 API가 여기 통합되어 있음.  
   - 회원가입 후 각 API별로 **인증키(일반/Encoding)** 발급.

2. **기관별 개발자 센터**  
   - K-Startup, NTIS, 코트라 등은 별도 개발자 페이지에서 API KEY 발급.

3. **환경 변수**  
   - `.env.example`을 복사해 `.env.local` 생성 후, 발급받은 키를 아래처럼 설정.  
   - `BIZINFO_API_KEY`, `KOSBI_API_KEY`, `NTIS_API_KEY` 등.

## 매칭 Open API (본 서비스)

외부에서 **기업 정보만 넣고 매칭 결과**를 받으려면 아래 엔드포인트를 사용하면 됩니다.

- **URL**: `POST /api/match` (배포 시 `https://도메인/api/match`)
- **Request Body** (JSON):
  - `companyName` (필수): 회사명
  - `revenue` (필수): 매출액 (원)
  - `bizType` (필수): 업태 (문자열 1개 또는 배열). 최소 1개 이상
  - `items` (필수): 종목 배열. 최소 1개 이상
  - `industryKeywords` (선택): 매칭 키워드 배열
  - `estDate` (선택): 설립일 YYYY-MM-DD
  - `region` (선택): 지역
  - `certifications` (선택): 인증/자격 키 배열(내부 상담용), 예: `["venture","patent"]`

- **Response** (JSON):
  - `companyName`, `totalExpectedAmount`, `matchCount`
  - `recommended`: 추천 공고 배열(passed=true)
  - `rejected`: 탈락 공고 배열(passed=false)
  - `bestMatch`: 추천 1순위(없으면 null)
  - 각 매칭 결과는 `score/confidence/reasons(or rejectReasons)`와 `amountRange`를 포함

예시 (curl):

```bash
curl -X POST https://your-domain/api/match \
  -H "Content-Type: application/json" \
  -d '{
    "companyName":"(주)테스트",
    "revenue":500000000,
    "bizType":["제조","서비스"],
    "items":["기술개발","제조"],
    "industryKeywords":["R&D","연구"],
    "certifications":["venture","patent"]
  }'
```

## 기업마당(Bizinfo) 수집 파이프라인 (Ingest)

### 구현 선택: Next.js Route Handler (권장)

| 방식 | 장점 | 단점 |
|------|------|------|
| **Next.js Route Handler** (`/api/ingest/bizinfo`) | `BIZINFO_API_KEY`를 `process.env`로만 사용 → **클라이언트에 노출되지 않음**. 같은 레포에서 배포·로깅·스케줄(cron) 연동이 쉬움. | - |
| Supabase Edge Function | 서버리스에서 DB와 동일 리전 실행 가능 | 별도 배포·env 설정 필요, 키 관리 분리 |

**권장**: Next.js Route Handler. API 키는 서버 전용 환경 변수로 두고, Ingest는 서버에서만 호출하도록 구성.

### 동작 요약

1. **Bizinfo 지원사업 API** 호출 (요청 시 `type=json` 우선, 응답이 XML이면 자동 파싱).
2. **원문** → `announcement_sources` 테이블에 upsert (`source_name=bizinfo`, `source_ann_id`, `raw_payload`).
3. **1차 매핑** → `grant_announcements`에 upsert (`title`, `agency`, `url`, `published_at`, `deadline_at`, `max_amount` 등, 가능한 필드만).

### 바로보기 URL 메모

- **URL은 소스별로 제공 여부/품질이 다릅니다.**
- 초기에는 **bizinfo / k-startup / ntis처럼 상세 URL을 제공하는 소스** 위주로 “공고 바로가기” 버튼을 제공하는 것이 안정적입니다.
- 본 프로젝트는 placeholder(예: `/example/`) 또는 기관 메인/루트 URL로 보이는 링크는 UI에서 숨기도록 처리합니다.

### 환경 변수 (서버 전용, 클라이언트 노출 금지)

| 변수 | 필수 | 설명 |
|------|------|------|
| `BIZINFO_API_KEY` | ○ | 기업마당(또는 공공데이터포털)에서 발급한 인증키 |
| `BIZINFO_API_BASE_URL` | | API Base URL (미설정 시 코드 내 기본값 사용. 실제 URL은 기업마당·공공데이터포털 API 명세 확인) |
| `NEXT_PUBLIC_SUPABASE_URL` | ○ (DB 저장 시) | Supabase 프로젝트 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ○ (DB 저장 시) | RLS 우회용 서비스 롤 키 (Ingest에서 insert/update용) |

### 로컬 실행 방법

1. **환경 변수 설정**  
   `.env.example`을 복사해 `.env.local` 생성 후 아래 값 설정.

   ```bash
   BIZINFO_API_KEY=발급받은_인증키
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=서비스롤_키
   ```

2. **Supabase 스키마 적용**  
   `supabase/schema.sql`을 Supabase에 적용해 `announcement_sources`, `grant_announcements` 테이블이 있어야 함.

3. **개발 서버 실행**

   ```bash
   npm install
   npm run dev
   ```

4. **Ingest API 호출**  
   브라우저 또는 curl로 **GET** 요청 (POST 아님).

   ```bash
   curl -X GET "http://localhost:3000/api/ingest/bizinfo"
   ```

   성공 시 예시:

   ```json
   {
     "ok": true,
     "message": "Bizinfo 수집 완료",
     "itemsFetched": 10,
     "sourcesUpserted": 10,
     "grantsUpserted": 10
     }
   ```

   API 키 미설정 시:

   ```json
   { "error": "BIZINFO_API_KEY가 설정되지 않았습니다." }
   ```

   Supabase 미설정 시:

   ```json
   { "error": "Supabase Admin(SUPABASE_SERVICE_ROLE_KEY) 미설정. DB 저장 불가." }
   ```

### 테스트용 curl 예시

```bash
# 로컬 (개발 서버 실행 중일 때)
curl -s -X GET "http://localhost:3000/api/ingest/bizinfo" | jq .

# 배포 환경 (실제 도메인·HTTPS)
curl -s -X GET "https://your-domain.com/api/ingest/bizinfo" | jq .
```

- **GET**만 사용 (수집 트리거용).  
- 인증: 내부용이면 서버에서만 호출하거나, 필요 시 API Route에 시크릿 헤더/쿼리 검증 추가.

### 응답 형식 (JSON/XML)

- API가 **JSON**을 주면 그대로 파싱.
- **XML**이면 `Content-Type: application/xml` 또는 응답 본문이 `<`로 시작할 때 자동으로 XML 파싱 후 JSON으로 정규화해 사용.

---

## 중소벤처24(SMES) 공고(민간공고목록정보) 수집 파이프라인 (Ingest)

중소벤처24 OpenAPI(예: 민간공고목록정보 `extPblancInfo`)를 호출해 `announcement_sources`에 원문을 저장하고, 공고성 데이터는 `grant_announcements`에 1차 매핑(upsert)합니다.

- **엔드포인트**: `GET /api/ingest/smes`
- **저장**:
  - 원문: `announcement_sources` (`source_name=smes`)
  - 공고: `grant_announcements` (`source_name=smes`)
- **응답**: 처리 건수 + `sample` 3개(정규화 일부 필드)

### 환경 변수 (서버 전용)

| 변수 | 필수 | 설명 |
|------|------|------|
| `SMES_API_BASE_URL` | ○ | SMES OpenAPI Base URL (extPblancInfo 등) |
| `SMES_EXT_PBLANC_API_KEY` | ○ | SMES API 인증키 |
| `NEXT_PUBLIC_SUPABASE_URL` | ○ (DB 저장 시) | Supabase 프로젝트 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ○ (DB 저장 시) | RLS 우회용 서비스 롤 키 |

### 테스트 (curl)

```bash
# 로컬
curl -s -X GET "http://localhost:3000/api/ingest/smes" | jq .

# 배포
curl -s -X GET "https://your-domain.com/api/ingest/smes" | jq .
```

---

## 창업진흥원 K-Startup 공고 조회 수집 파이프라인 (Ingest)

창업진흥원 K-Startup(사업공고 등) OpenAPI를 호출해 `announcement_sources`에 원문을 저장하고, `grant_announcements`에 1차 매핑(제목·기관·URL·일정·한도)을 upsert합니다. 이후 `source_name=kstartup`으로 LLM 파싱(`/api/ingest/parse`) 연동 가능합니다.

### 동작 요약

1. **K-Startup OpenAPI** 호출 (Base URL + API Key, 응답 JSON/XML 모두 파싱).
2. **원문** → `announcement_sources` upsert (`source_name=kstartup`, `source_ann_id`, `raw_payload`).
3. **1차 매핑** → `grant_announcements` upsert (`title`, `agency=창업진흥원`, `url`, `published_at`, `deadline_at`, `max_amount`).

### 환경 변수 (서버 전용, API Key 노출 금지)

| 변수 | 필수 | 설명 |
|------|------|------|
| `KSTARTUP_API_BASE_URL` | ○ | K-Startup API Base URL (공공데이터포털·창업진흥원 API 명세 확인) |
| `KSTARTUP_API_KEY` | ○ | K-Startup API 인증키 (serviceKey 등) |
| `NEXT_PUBLIC_SUPABASE_URL` | ○ (DB 저장 시) | Supabase 프로젝트 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ○ (DB 저장 시) | RLS 우회용 서비스 롤 키 |

### 테스트 (curl)

```bash
# 로컬 (개발 서버 실행 중일 때)
curl -s -X GET "http://localhost:3000/api/ingest/kstartup" | jq .

# 배포 환경
curl -s -X GET "https://your-domain.com/api/ingest/kstartup" | jq .
```

성공 시 예시:

```json
{
  "ok": true,
  "message": "K-Startup 수집 완료",
  "itemsFetched": 10,
  "sourcesUpserted": 10,
  "grantsUpserted": 10
}
```

### 파싱 연동

수집 후 LLM 파싱으로 표준 스키마·target_criteria 보강:

```bash
curl -s "http://localhost:3000/api/ingest/parse?source_name=kstartup&limit=20" | jq .
```

---

## KODIT 보증 운영현황(통계) 수집 (Ingest)

KODIT 통계는 “공고”가 아니라서 `grant_announcements`로 매핑하지 않고 **원문만 `announcement_sources`에 저장**합니다.

- **엔드포인트**:
  - `GET /api/ingest/kodit-stats` (권장)
  - `GET /api/ingest/kodit/stats` (동일 동작)
- **저장**: `announcement_sources` (`source_name=kodit_stats`)
- **응답**: 처리 건수 + `sample` 3개

### 환경 변수 (서버 전용)

| 변수 | 필수 | 설명 |
|------|------|------|
| `KODIT_STATS_API_BASE_URL` | ○ | KODIT 통계 API Base URL |
| `KODIT_STATS_API_KEY` | ○ | KODIT 통계 API 인증키 |
| `NEXT_PUBLIC_SUPABASE_URL` | ○ (DB 저장 시) | Supabase 프로젝트 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ○ (DB 저장 시) | RLS 우회용 서비스 롤 키 |

### 테스트 (curl)

```bash
# 로컬
curl -s -X GET "http://localhost:3000/api/ingest/kodit-stats" | jq .

# 배포
curl -s -X GET "https://your-domain.com/api/ingest/kodit-stats" | jq .
```

---

## 공고 원문 파싱 (LLM → 표준 스키마)

`announcement_sources`의 **raw_payload(원문)**를 텍스트로 추출한 뒤 **GPT(OpenAI)**로 표준 스키마 JSON을 생성하고, **grant_announcements**를 upsert합니다.

### 구현 구조 (`lib/parsing/`)

| 파일 | 역할 |
|------|------|
| **types.ts** | `ParsedAnnouncement` 타입 (표준 스키마 필드 + target_criteria) |
| **prompt.ts** | "JSON만 출력, 누락은 null, 단위 명시" 프롬프트 빌더. 원문 상한(12k~20k chars)으로 비용 보호. 중요 조건(대상/한도/금리/기간) 중심 추출 |
| **parseWithLLM.ts** | `OPENAI_API_KEY`, `OPENAI_CHAT_MODEL` 사용(서버 전용). 응답에서 JSON만 안전 추출(코드블록/잡텍스트 제거). normalize: 억/만원/개월/년 → 원·개월 변환 |
| **batch.ts** | `extractTextFromRawPayload(raw_payload)`: content/body/detail/description 등 우선 탐색, 없으면 JSON stringify 후 요약 텍스트. `batchParseAndUpsertFromSource({ source_name, limit, since })`: announcement_sources 조회 → 파싱 → grant_announcements upsert. 실패 항목은 failures 배열로 수집 |

### 환경 변수 (서버 전용, 키는 로그에 절대 출력하지 않음)

| 변수 | 필수 | 설명 |
|------|------|------|
| `OPENAI_API_KEY` | ○ | OpenAI API 키 (LLM 파싱용) |
| `OPENAI_CHAT_MODEL` | | 채팅 모델 (미설정 시 `gpt-4o-mini`) |
| `NEXT_PUBLIC_SUPABASE_URL` | ○ (DB 저장 시) | Supabase 프로젝트 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ○ (DB 저장 시) | RLS 우회용 서비스 롤 키 |

### API: 파싱 배치 트리거

- **URL**: `GET /api/ingest/parse?source_name=bizinfo&limit=20`
- **쿼리**: `source_name`(필수, 예: bizinfo, kstartup), `limit`(선택, 기본 20, 최대 100)
- **응답**: `{ processed, success, failed, failures: [{ source_ann_id, reason }] }`

### 테스트 (curl)

```bash
curl -s "http://localhost:3000/api/ingest/parse?source_name=bizinfo&limit=20" | jq .
```

- 로컬 개발 서버 실행 후 호출. 성공 시 `processed`, `success`, `failed`, `failures` 필드로 결과 확인.
- limit 기본 20, 최대 100으로 과금 폭주 방지. 원문은 상한 길이(12k~20k chars)로 잘라서 전송.

---

## 데이터 파이프라인 구현 시

1. **수집**: `/api/ingest/bizinfo`, `/api/ingest/kstartup` 등으로 API 호출 → `announcement_sources` + `grant_announcements` 1차 저장.  
2. **정제**: `GET /api/ingest/parse?source_name=bizinfo` 또는 `source_name=kstartup` 등으로 원문 → LLM 파싱 → `grant_announcements` 표준 스키마·target_criteria upsert.  
3. **매칭**: 현재 `lib/matching/algorithm.ts`가 `target_criteria` 기준으로 지원금 3단계(보수/기준/최대)·적합도 점수(예상 가능성/적합도)·순위를 계산.  
4. **Open API**: `/api/match`가 위 로직을 그대로 사용하므로, 공고 데이터만 실제 API로 채우면 됨.

이 문서는 기관별 API 명세가 바뀔 수 있으므로, 실제 연동 시 각 기관 개발자 문서를 참고해 주세요.
