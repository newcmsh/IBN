# 공공데이터포털 데이터 수집 — 코드 구조와 흐름

공공데이터포털(data.go.kr) 또는 동일한 스타일의 API에서 **어떤 식으로 데이터를 수집하는지**, **코드는 어떤 구조로 만들어져 있는지** 정리한 문서입니다.

---

## 1. 전체 흐름 (한눈에)

```
[호출] GET /api/ingest/bizinfo 또는 /api/ingest/smes
    ↓
① API URL + 쿼리(serviceKey, type/returnType) 구성
    ↓
② fetch() 로 공공 API GET 요청
    ↓
③ 응답 본문 파싱: JSON 또는 XML → JSON 객체 (parseResponse)
    ↓
④ 응답에서 공고 목록(배열) 추출 (extractItemsFromResponse)
    ↓
⑤ 각 항목을 표준 필드로 정규화 (normalizeItem)
    ↓
⑥ DB 저장
    - announcement_sources: 원문(raw_payload) upsert
    - grant_announcements: 1차 매핑(title, agency, url, 일정, max_amount) upsert
    ↓
[응답] 수집 건수, sample 3건 반환
```

---

## 2. 단계별 코드 위치와 역할

### 2.1 API 호출 (Route Handler)

**역할**: 환경 변수에서 Base URL·API Key를 읽고, **공공데이터포털에서 흔히 쓰는 쿼리**로 URL을 만든 뒤 `fetch`로 GET 요청합니다.

**파일**: `app/api/ingest/bizinfo/route.ts`, `app/api/ingest/smes/route.ts`

**Bizinfo 예시** — URL 구성 후 fetch:

```ts
// app/api/ingest/bizinfo/route.ts

const baseUrl = process.env.BIZINFO_API_BASE_URL?.trim() || DEFAULT_BIZINFO_BASE_URL;
const url = new URL(baseUrl);
url.searchParams.set("serviceKey", apiKey);
url.searchParams.set("type", "json");

res = await fetch(url.toString(), {
  method: "GET",
  headers: { Accept: "application/json, application/xml, text/xml, */*" },
  next: { revalidate: 0 },
});
```

**SMES 예시** — data.go.kr 패턴 + 호출자 쿼리 전달:

```ts
// app/api/ingest/smes/route.ts

const url = new URL(baseUrl);
url.searchParams.set("serviceKey", apiKey);
url.searchParams.set("returnType", "JSON");

// pageNo, numOfRows 등 호출자가 넣은 쿼리 그대로 전달
request.nextUrl.searchParams.forEach((v, k) => {
  if (k === "serviceKey" || k === "returnType") return;
  url.searchParams.set(k, v);
});

res = await fetch(url.toString(), { ... });
```

- 공공데이터포털 계열은 대부분 **GET** + **serviceKey** 필수, **returnType** 또는 **type**으로 JSON/XML 선택합니다.
- SMES는 `?pageNo=1&numOfRows=10` 처럼 **페이지 파라미터**를 그대로 넘길 수 있게 해 두었습니다.

---

### 2.2 응답 파싱 (JSON / XML → JSON 객체)

**역할**: API가 **JSON**을 주면 `JSON.parse`, **XML**을 주면 `fast-xml-parser`로 파싱해 **동일하게 JSON 객체**로 만듭니다. 공공 API가 상황에 따라 XML만 주는 경우를 대비한 공통 모듈입니다.

**파일**: `lib/ingest/parseResponse.ts`

```ts
// lib/ingest/parseResponse.ts

import { XMLParser } from "fast-xml-parser";

const xmlParser = new XMLParser({
  ignoreDeclaration: true,
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
});

export function parseApiResponse(body: string, contentType: string | null): unknown {
  const isXml =
    (contentType && contentType.toLowerCase().includes("xml")) ||
    body.trimStart().startsWith("<");
  if (isXml) {
    try {
      return xmlParser.parse(body) as unknown;
    } catch {
      return null;
    }
  }
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
}
```

**Route에서 사용**:

```ts
const text = await res.text();
const parsed = parseApiResponse(text, res.headers.get("content-type") ?? "");
if (parsed == null) {
  return NextResponse.json({ error: "API 응답 파싱 실패 ..." }, { status: 502 });
}
```

---

### 2.3 공고 목록(배열) 추출

**역할**: 파싱된 JSON **한 덩어리**에서 **공고 하나하나에 해당하는 배열**을 찾습니다. API마다 구조가 다르므로(`items`, `item`, `response.body.items` 등) 여러 형태를 시도합니다.

**파일**: `lib/ingest/bizinfo.ts` → `extractItemsFromResponse`, `lib/ingest/smes.ts` → `extractItemsFromResponse`

**Bizinfo** — 흔한 키 순서로 배열 찾기:

```ts
// lib/ingest/bizinfo.ts

export function extractItemsFromResponse(data: unknown): BizinfoRawItem[] {
  if (Array.isArray(data)) return data as BizinfoRawItem[];
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.items)) return o.items as BizinfoRawItem[];
    if (o.item != null) return ensureArray(o.item) as BizinfoRawItem[];
    if (o.response?.body?.items) return ...;
    if (Array.isArray(o.list)) return o.list as BizinfoRawItem[];
  }
  return [];
}
```

**SMES** — data.go.kr 계열에서 자주 나오는 구조 대응:

```ts
// lib/ingest/smes.ts

const directCandidates = [o.items, o.item, o.list, o.data, o.results, o.result, o.rows];
// response.body / response.data 계열도 탐색
```

- 공공데이터포털 API는 **response → body → items** 같은 중첩 구조를 쓰는 경우가 많아, 두 소스 모두 그에 맞춰 배열을 추출합니다.

---

### 2.4 항목별 정규화 (원문 → 표준 필드)

**역할**: API별로 **필드 이름이 다르기 때문에**(예: 제목 = `title` / `bzopNm` / `pblancNm`) 하나의 **표준 형태**로 바꿉니다. 이렇게 해야 DB와 매칭 엔진에서 동일한 필드(title, agency, url, published_at, deadline_at, max_amount)를 사용할 수 있습니다.

**파일**: `lib/ingest/bizinfo.ts` → `normalizeItem`, `lib/ingest/smes.ts` → `normalizeItem`

**Bizinfo** — 제목·기관·URL·일정·한도 매핑:

```ts
// lib/ingest/bizinfo.ts

export function normalizeItem(item: BizinfoRawItem, index: number): NormalizedAnnouncement {
  const source_ann_id = toSourceAnnId(item, index);
  const title =
    safeStr(item.title) || safeStr(item.bzopNm) || safeStr(item.bzopName) ||
    safeStr(item.sj) || safeStr(item.subject) || `공고 ${source_ann_id}`;
  const agency =
    safeStr(item.agency) || safeStr(item.orgNm) || safeStr(item.organName) || safeStr(item.instNm) || "";
  const url = safeStr(item.url) || safeStr(item.link) || safeStr(item.detailUrl) || null;
  const published_at = safeDate(item.publishedAt) ?? safeDate(item.regDt) ?? ...;
  const deadline_at = safeDate(item.deadlineAt) ?? safeDate(item.endDt) ?? ...;
  const max_amount = safeNum(item.maxAmount) ?? safeNum(item.max_amount) ?? safeNum(item.limitAmt) ?? ...;

  return {
    source_ann_id,
    title,
    agency: agency || "기업마당",
    url,
    published_at,
    deadline_at,
    max_amount,
    raw: item,
  };
}
```

**SMES** — 공공데이터포털/중소벤처24 쪽 필드명 대응:

```ts
// lib/ingest/smes.ts

const title =
  safeStr(item.title) || safeStr(item.pblancNm) || safeStr(item.pbancNm) ||
  safeStr(item.bizPbancNm) || safeStr(item.subject) || safeStr(item.sj) || ...;
const agency =
  safeStr(item.agency) || safeStr(item.instNm) || safeStr(item.orgNm) || ...;
// url, published_at, deadline_at, max_amount 도 여러 후보 필드 시도
```

- **source_ann_id**: API마다 다른 ID 필드(`bzopSeq`, `pblancId`, `id` 등)를 시도해 고유 문자열 하나로 만듭니다.
- **raw**: 원문 객체를 그대로 넣어 두어, 나중에 LLM 파싱 등에서 사용합니다.

---

### 2.5 DB 저장 (원문 + 1차 매핑)

**역할**: 수집한 데이터를 **두 테이블**에 넣습니다.

1. **announcement_sources**  
   - 원문 전체를 `raw_payload`로 보관 (나중에 LLM 파싱·재가공용).
2. **grant_announcements**  
   - 정규화된 필드만으로 1차 매핑 (title, agency, url, published_at, deadline_at, max_amount, target_criteria 등). 매칭 API는 여기 있는 데이터를 사용합니다.

**파일**: 동일 Route 안에서 Supabase Admin 클라이언트로 upsert.

```ts
// app/api/ingest/bizinfo/route.ts (SMES도 동일 패턴)

for (let i = 0; i < items.length; i++) {
  const item = items[i];
  const norm = normalizeItem(item, i);

  // 1) 원문 저장
  await admin.from("announcement_sources").upsert({
    source_name: SOURCE_NAME,
    source_ann_id: norm.source_ann_id,
    raw_payload: norm.raw,
    updated_at: new Date().toISOString(),
  }, { onConflict: "source_name,source_ann_id" });

  // 2) 공고 1차 매핑 저장
  await admin.from("grant_announcements").upsert({
    source_name: SOURCE_NAME,
    source_ann_id: norm.source_ann_id,
    agency: norm.agency,
    title: norm.title,
    max_amount: norm.max_amount ?? 0,
    url: norm.url,
    source_url: norm.url,
    published_at: norm.published_at,
    deadline_at: norm.deadline_at,
    target_criteria: {},
    updated_at: new Date().toISOString(),
  }, { onConflict: "source_name,source_ann_id" });
}
```

- **onConflict: "source_name,source_ann_id"** 로 같은 소스·같은 공고는 **재수집 시 덮어쓰기**됩니다.

---

## 3. 파일별 정리

| 파일 | 역할 |
|------|------|
| `app/api/ingest/bizinfo/route.ts` | 기업마당(공공데이터포털) API 호출, 파싱·추출·정규화 호출, DB upsert, 응답 반환 |
| `app/api/ingest/smes/route.ts` | 중소벤처24(공공데이터포털 스타일) API 호출, 동일 파이프라인 + pageNo/numOfRows 전달 |
| `lib/ingest/parseResponse.ts` | 응답 본문 JSON/XML → JSON 객체 (공통) |
| `lib/ingest/bizinfo.ts` | Bizinfo 전용: extractItemsFromResponse, toSourceAnnId, normalizeItem |
| `lib/ingest/smes.ts` | SMES 전용: extractItemsFromResponse, toSourceAnnId, normalizeItem |

공공데이터포털에서 **다른 API**를 추가할 때는:

1. **Route** 하나 추가 (URL·쿼리 구성 → fetch → parseApiResponse → extract → normalize → DB).
2. **lib/ingest/소스명.ts** 에 해당 API 응답 구조에 맞는 `extractItemsFromResponse`, `normalizeItem` (및 필요 시 `toSourceAnnId`) 구현.
3. `parseResponse`는 그대로 재사용하면 됩니다.

---

## 4. 환경 변수와 호출 예시

**Bizinfo**  
- `BIZINFO_API_KEY`, (선택) `BIZINFO_API_BASE_URL`  
- 호출: `GET /api/ingest/bizinfo`

**SMES**  
- `SMES_API_BASE_URL`, `SMES_EXT_PBLANC_API_KEY`  
- 호출: `GET /api/ingest/smes` 또는 `GET /api/ingest/smes?pageNo=1&numOfRows=10`

```bash
curl -s -X GET "http://localhost:3000/api/ingest/bizinfo" | jq .
curl -s -X GET "http://localhost:3000/api/ingest/smes?pageNo=1&numOfRows=10" | jq .
```

---

## 5. 요약

- **공공데이터포털**에서 데이터를 수집할 때는 **GET + serviceKey + returnType/type** 로 요청하고, **JSON/XML 모두** 올 수 있다고 가정해 **parseResponse**로 통일된 JSON으로 만든 뒤, **소스별 extract → normalize** 로 표준 필드로 바꿉니다.
- **코드 구조**는 **Route(호출·오케스트레이션)** 와 **lib/ingest(파싱·추출·정규화)** 로 나뉘며, 새 공공 API를 붙일 때는 **lib/ingest** 에 소스 전용 추출/정규화만 추가하면 됩니다.

더 많은 API 목록·curl·환경 변수는 `docs/API_INTEGRATION.md` 의 “공공데이터포털(data.go.kr) API” 섹션을 참고하면 됩니다.
