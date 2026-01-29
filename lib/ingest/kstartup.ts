/**
 * 창업진흥원 K-Startup 공고 조회 API 수집·정규화
 * - JSON/XML 응답 모두 파싱 가능 (parseResponse 사용)
 * - announcement_sources / grant_announcements 1차 매핑용
 */

export const SOURCE_NAME = "kstartup";
const AGENCY = "창업진흥원";

export interface KstartupRawItem {
  [key: string]: unknown;
}

function ensureArray<T>(v: T | T[] | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/** API 응답에서 공고 목록(배열) 추출. JSON/XML 다양한 응답 구조 대응 */
export function extractItemsFromResponse(data: unknown): KstartupRawItem[] {
  if (Array.isArray(data)) return data as KstartupRawItem[];
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.items)) return o.items as KstartupRawItem[];
    if (o.item != null) return ensureArray(o.item) as KstartupRawItem[];
    if (o.list != null) return ensureArray(o.list) as KstartupRawItem[];
    if (o.data != null && Array.isArray(o.data)) return o.data as KstartupRawItem[];
    if (o.response && typeof o.response === "object") {
      const r = o.response as Record<string, unknown>;
      const body = r.body ?? r.data ?? r.result;
      if (body && typeof body === "object") {
        const b = body as Record<string, unknown>;
        if (Array.isArray(b.items)) return b.items as KstartupRawItem[];
        if (b.item != null) return ensureArray(b.item) as KstartupRawItem[];
        if (Array.isArray(b.list)) return b.list as KstartupRawItem[];
        if (Array.isArray(b.data)) return b.data as KstartupRawItem[];
      }
    }
  }
  return [];
}

/** 원문 1건 → source_ann_id (고유 문자열) */
export function toSourceAnnId(item: KstartupRawItem, index: number): string {
  const id =
    (item.id as string) ??
    (item.seq as string) ??
    (item.annId as string) ??
    (item.sn as string) ??
    (item.bzopSeq as string) ??
    (item.no as string) ??
    String(index + 1);
  return String(id).trim() || `item-${index + 1}`;
}

/** 1차 매핑: title, agency='창업진흥원', url, published_at, deadline_at, max_amount */
export interface NormalizedKstartupAnnouncement {
  source_ann_id: string;
  title: string;
  agency: string;
  url: string | null;
  published_at: string | null;
  deadline_at: string | null;
  max_amount: number | null;
  raw: KstartupRawItem;
}

const safeStr = (v: unknown): string => (v != null ? String(v).trim() : "");
const safeNum = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const safeDate = (v: unknown): string | null => {
  const s = safeStr(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d.toISOString() : s;
};

export function normalizeItem(item: KstartupRawItem, index: number): NormalizedKstartupAnnouncement {
  const source_ann_id = toSourceAnnId(item, index);
  const title =
    safeStr(item.title) ||
    safeStr(item.bzopNm) ||
    safeStr(item.sj) ||
    safeStr(item.subject) ||
    safeStr(item.businessNm) ||
    safeStr(item.name) ||
    `공고 ${source_ann_id}`;
  const url =
    safeStr(item.url) ||
    safeStr(item.link) ||
    safeStr(item.detailUrl) ||
    safeStr(item.detailLink) ||
    null;
  const published_at =
    safeDate(item.publishedAt) ??
    safeDate(item.regDt) ??
    safeDate(item.rgstDt) ??
    safeDate(item.pubDate) ??
    safeDate(item.startDt) ??
    null;
  const deadline_at =
    safeDate(item.deadlineAt) ??
    safeDate(item.endDt) ??
    safeDate(item.dlDt) ??
    safeDate(item.deadline) ??
    safeDate(item.applyEndDt) ??
    null;
  const max_amount =
    safeNum(item.maxAmount) ??
    safeNum(item.max_amount) ??
    safeNum(item.limitAmt) ??
    safeNum(item.sptLmtAmt) ??
    safeNum(item.supportLimit) ??
    null;

  return {
    source_ann_id,
    title,
    agency: AGENCY,
    url: url || null,
    published_at,
    deadline_at,
    max_amount,
    raw: item,
  };
}
