/**
 * 신용보증기금(KODIT) 보증 운영현황 집계 OpenAPI 수집
 * - 연도별·상품유형별 집계 데이터 → announcement_sources만 저장 (grant_announcements 미매핑)
 * - 시장 통계/리포트·대시보드용
 */

export const SOURCE_NAME = "kodit_stats";

export interface KoditStatsRawRow {
  [key: string]: unknown;
}

function ensureArray<T>(v: T | T[] | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/** API 응답에서 집계 행 배열 추출. JSON/XML 다양한 구조 대응 */
export function extractRowsFromResponse(data: unknown): KoditStatsRawRow[] {
  if (Array.isArray(data)) return data as KoditStatsRawRow[];
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.data)) return o.data as KoditStatsRawRow[];
    if (Array.isArray(o.list)) return o.list as KoditStatsRawRow[];
    if (Array.isArray(o.items)) return o.items as KoditStatsRawRow[];
    if (o.item != null) return ensureArray(o.item) as KoditStatsRawRow[];
    if (o.response && typeof o.response === "object") {
      const r = o.response as Record<string, unknown>;
      const body = r.body ?? r.data ?? r.result;
      if (body && typeof body === "object") {
        const b = body as Record<string, unknown>;
        if (Array.isArray(b.data)) return b.data as KoditStatsRawRow[];
        if (Array.isArray(b.list)) return b.list as KoditStatsRawRow[];
        if (Array.isArray(b.items)) return b.items as KoditStatsRawRow[];
        if (b.item != null) return ensureArray(b.item) as KoditStatsRawRow[];
      }
    }
  }
  return [];
}

const safeStr = (v: unknown): string => (v != null ? String(v).trim() : "");

/** 연도 + 상품유형 조합으로 source_ann_id 생성 */
export function toSourceAnnId(row: KoditStatsRawRow, index: number): string {
  const year =
    safeStr(row.stdYr) ||
    safeStr(row.year) ||
    safeStr(row.yr) ||
    safeStr(row.baseYear) ||
    safeStr(row.기준연도);
  const type =
    safeStr(row.guaranteeType) ||
    safeStr(row.productNm) ||
    safeStr(row.productType) ||
    safeStr(row.type) ||
    safeStr(row.보증종류) ||
    safeStr(row.상품유형);
  const combined = [year, type].filter(Boolean).join("_") || `row_${index + 1}`;
  return combined.replace(/\s+/g, "_").slice(0, 200);
}
