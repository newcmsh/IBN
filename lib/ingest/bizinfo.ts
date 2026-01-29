/**
 * 기업마당(Bizinfo) 지원사업 API 수집·정규화
 * - JSON 응답: 그대로 사용
 * - XML 응답: 파싱 후 JSON으로 정규화
 * - announcement_sources / grant_announcements 1차 매핑용 아이템 추출
 */

const SOURCE_NAME = "bizinfo";

export interface BizinfoRawItem {
  [key: string]: unknown;
}

function ensureArray<T>(v: T | T[] | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/** API 응답에서 공고 목록(배열) 추출. JSON/XML 다양한 응답 구조 대응 (item 단일 객체 시 배열로 보정) */
export function extractItemsFromResponse(data: unknown): BizinfoRawItem[] {
  if (Array.isArray(data)) return data as BizinfoRawItem[];
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.items)) return o.items as BizinfoRawItem[];
    if (o.item != null) return ensureArray(o.item) as BizinfoRawItem[];
    if (o.response && typeof o.response === "object") {
      const r = o.response as Record<string, unknown>;
      const body = r.body ?? r.data;
      if (body && typeof body === "object") {
        const b = body as Record<string, unknown>;
        if (Array.isArray(b.items)) return b.items as BizinfoRawItem[];
        if (b.item != null) return ensureArray(b.item) as BizinfoRawItem[];
      }
    }
    if (Array.isArray(o.list)) return o.list as BizinfoRawItem[];
  }
  return [];
}

/** 원문 1건 → source_ann_id (고유 문자열) */
export function toSourceAnnId(item: BizinfoRawItem, index: number): string {
  const id =
    (item.bzopSeq as string) ??
    (item.bzopSeqNo as string) ??
    (item.seq as string) ??
    (item.id as string) ??
    (item.sn as string) ??
    String(index + 1);
  return String(id).trim() || `item-${index + 1}`;
}

/** 1차 매핑: title, agency, url, published_at, deadline_at, max_amount (가능한 필드만) */
export interface NormalizedAnnouncement {
  source_ann_id: string;
  title: string;
  agency: string;
  url: string | null;
  published_at: string | null;
  deadline_at: string | null;
  max_amount: number | null;
  raw: BizinfoRawItem;
}

const safeStr = (v: unknown): string => (v != null ? String(v).trim() : "");
const safeNum = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
/** 날짜 유사 문자열을 ISO 또는 그대로 반환 (DB TIMESTAMPTZ 호환) */
const safeDate = (v: unknown): string | null => {
  const s = safeStr(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d.toISOString() : s;
};

export function normalizeItem(item: BizinfoRawItem, index: number): NormalizedAnnouncement {
  const source_ann_id = toSourceAnnId(item, index);
  const title =
    safeStr(item.title) ||
    safeStr(item.bzopNm) ||
    safeStr(item.bzopName) ||
    safeStr(item.sj) ||
    safeStr(item.subject) ||
    `공고 ${source_ann_id}`;
  const agency =
    safeStr(item.agency) ||
    safeStr(item.orgNm) ||
    safeStr(item.organName) ||
    safeStr(item.instNm) ||
    "";
  const url = safeStr(item.url) || safeStr(item.link) || safeStr(item.detailUrl) || null;
  const published_at = safeDate(item.publishedAt) ?? safeDate(item.regDt) ?? safeDate(item.rgstDt) ?? safeDate(item.pubDate) ?? null;
  const deadline_at = safeDate(item.deadlineAt) ?? safeDate(item.endDt) ?? safeDate(item.dlDt) ?? safeDate(item.deadline) ?? null;
  const max_amount = safeNum(item.maxAmount) ?? safeNum(item.max_amount) ?? safeNum(item.limitAmt) ?? safeNum(item.sptLmtAmt) ?? null;

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

export { SOURCE_NAME };
