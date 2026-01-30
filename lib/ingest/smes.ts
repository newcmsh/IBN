/**
 * 중소벤처24(중소벤처기업부/중기부) 공고(민간공고목록정보=extPblancInfo 등) 수집·정규화
 * - 응답 구조가 불확실하므로 items 배열을 방어적으로 탐색
 * - announcement_sources / grant_announcements 1차 매핑용
 */

export const SOURCE_NAME = "smes";
const DEFAULT_AGENCY = "중소벤처24";

export interface SmesRawItem {
  [key: string]: unknown;
}

function ensureArray<T>(v: T | T[] | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/** 다양한 응답 구조에서 item 목록(배열) 추출 */
export function extractItemsFromResponse(data: unknown): SmesRawItem[] {
  if (Array.isArray(data)) return data as SmesRawItem[];
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;

    // 흔한 키들
    const directCandidates = [
      o.items,
      o.item,
      o.list,
      o.data,
      o.results,
      o.result,
      o.rows,
    ];
    for (const c of directCandidates) {
      if (Array.isArray(c)) return c as SmesRawItem[];
      if (c != null && typeof c === "object" && Array.isArray((c as any).item)) return (c as any).item as SmesRawItem[];
      if (c != null && typeof c === "object" && Array.isArray((c as any).items)) return (c as any).items as SmesRawItem[];
      if (c != null && typeof c === "object" && (c as any).item != null) return ensureArray((c as any).item) as SmesRawItem[];
    }

    // response.body 계열
    const response = o.response;
    if (response && typeof response === "object") {
      const r = response as Record<string, unknown>;
      const body = (r.body ?? r.data ?? r.result ?? r.results) as unknown;
      if (body && typeof body === "object") {
        const b = body as Record<string, unknown>;
        const cand = [b.items, b.item, b.list, b.data, b.rows];
        for (const c of cand) {
          if (Array.isArray(c)) return c as SmesRawItem[];
          if (c != null && typeof c === "object" && (c as any).item != null) return ensureArray((c as any).item) as SmesRawItem[];
        }
      }
    }
  }
  return [];
}

const safeStr = (v: unknown): string => (v != null ? String(v).trim() : "");
const safeNum = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};
const safeIso = (v: unknown): string | null => {
  const s = safeStr(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
};
const safeHttpUrl = (v: unknown): string | null => {
  const s = safeStr(v);
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
};

/** 원문 1건 → source_ann_id */
export function toSourceAnnId(item: SmesRawItem, index: number): string {
  const id =
    safeStr(item.source_ann_id) ||
    safeStr(item.sourceAnnId) ||
    safeStr(item.pblancId) ||
    safeStr(item.pblancNo) ||
    safeStr(item.extPblancId) ||
    safeStr(item.extPblancNo) ||
    safeStr(item.pbancSn) ||
    safeStr(item.sn) ||
    safeStr(item.id) ||
    String(index + 1);
  return id || `item-${index + 1}`;
}

export interface NormalizedSmesAnnouncement {
  source_ann_id: string;
  title: string;
  agency: string;
  url: string | null;
  published_at: string | null;
  deadline_at: string | null;
  max_amount: number | null;
  raw: SmesRawItem;
}

/** 1차 매핑 */
export function normalizeItem(item: SmesRawItem, index: number): NormalizedSmesAnnouncement {
  const source_ann_id = toSourceAnnId(item, index);
  const title =
    safeStr(item.title) ||
    safeStr(item.pblancNm) ||
    safeStr(item.pbancNm) ||
    safeStr(item.bizPbancNm) ||
    safeStr(item.subject) ||
    safeStr(item.sj) ||
    `공고 ${source_ann_id}`;
  const agency =
    safeStr(item.agency) ||
    safeStr(item.instNm) ||
    safeStr(item.orgNm) ||
    safeStr(item.orgName) ||
    DEFAULT_AGENCY;

  const url =
    safeHttpUrl(item.url) ??
    safeHttpUrl(item.detailUrl) ??
    safeHttpUrl(item.link) ??
    safeHttpUrl(item.detailLink) ??
    safeHttpUrl(item.pblancUrl) ??
    null;

  const published_at =
    safeIso(item.publishedAt) ??
    safeIso(item.published_at) ??
    safeIso(item.regDt) ??
    safeIso(item.rgstDt) ??
    safeIso(item.pubDate) ??
    safeIso(item.startDt) ??
    null;

  const deadline_at =
    safeIso(item.deadlineAt) ??
    safeIso(item.deadline_at) ??
    safeIso(item.endDt) ??
    safeIso(item.closeDt) ??
    safeIso(item.applyEndDt) ??
    safeIso(item.dlDt) ??
    null;

  const max_amount =
    safeNum(item.maxAmount) ??
    safeNum(item.max_amount) ??
    safeNum(item.supportAmt) ??
    safeNum(item.supportAmount) ??
    safeNum(item.maxSptAmt) ??
    safeNum(item.limitAmt) ??
    null;

  return {
    source_ann_id,
    title,
    agency,
    url,
    published_at,
    deadline_at,
    max_amount,
    raw: item,
  };
}

