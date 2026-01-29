/**
 * 신용보증재단중앙회(KOREG) 재보증 상품 목록 OpenAPI 수집
 * - 상품명, 상품순번, 보증유형, 주상품여부 포함
 * - announcement_sources만 저장 (source_name='koreg_product', source_ann_id=상품순번)
 * - 매칭 알고리즘에서 "보증 유형 라벨" lookup용 함수 제공
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const SOURCE_NAME = "koreg_product";

export interface KoregProductRawItem {
  [key: string]: unknown;
}

function ensureArray<T>(v: T | T[] | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/** API 응답에서 상품 목록 배열 추출 */
export function extractProductsFromResponse(data: unknown): KoregProductRawItem[] {
  if (Array.isArray(data)) return data as KoregProductRawItem[];
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.data)) return o.data as KoregProductRawItem[];
    if (Array.isArray(o.list)) return o.list as KoregProductRawItem[];
    if (Array.isArray(o.items)) return o.items as KoregProductRawItem[];
    if (o.item != null) return ensureArray(o.item) as KoregProductRawItem[];
    if (o.response && typeof o.response === "object") {
      const r = o.response as Record<string, unknown>;
      const body = r.body ?? r.data ?? r.result;
      if (body && typeof body === "object") {
        const b = body as Record<string, unknown>;
        if (Array.isArray(b.data)) return b.data as KoregProductRawItem[];
        if (Array.isArray(b.list)) return b.list as KoregProductRawItem[];
        if (Array.isArray(b.items)) return b.items as KoregProductRawItem[];
        if (b.item != null) return ensureArray(b.item) as KoregProductRawItem[];
      }
    }
  }
  return [];
}

const safeStr = (v: unknown): string => (v != null ? String(v).trim() : "");
const safeBool = (v: unknown): boolean =>
  v === true || v === "Y" || v === "y" || v === "1" || safeStr(v).toUpperCase() === "Y";

/** 상품순번으로 source_ann_id 생성 */
export function toSourceAnnId(item: KoregProductRawItem, index: number): string {
  const seq =
    safeStr(item.상품순번) ||
    safeStr(item.productSeq) ||
    safeStr(item.productNo) ||
    safeStr(item.seq) ||
    safeStr(item.id) ||
    safeStr(item.sn);
  return seq || `product_${index + 1}`;
}

/** raw_payload에서 추출한 보증 유형 라벨용 항목 (매칭 알고리즘 lookup) */
export interface KoregProductLookupItem {
  productId: string;
  productName: string;
  guaranteeType: string;
  isMainProduct: boolean;
  raw?: Record<string, unknown>;
}

function rowToLookupItem(row: { source_ann_id: string; raw_payload: Record<string, unknown> | null }): KoregProductLookupItem {
  const r = (row.raw_payload ?? {}) as KoregProductRawItem;
  return {
    productId: row.source_ann_id,
    productName:
      safeStr(r.상품명) ||
      safeStr(r.productNm) ||
      safeStr(r.productName) ||
      safeStr(r.name) ||
      "",
    guaranteeType:
      safeStr(r.보증유형) ||
      safeStr(r.guaranteeType) ||
      safeStr(r.guaranteeKind) ||
      safeStr(r.type) ||
      "",
    isMainProduct:
      safeBool(r.주상품여부) ||
      safeBool(r.mainProductYn) ||
      safeBool(r.isMain) ||
      false,
    raw: r as Record<string, unknown>,
  };
}

/**
 * announcement_sources에서 KOREG 재보증 상품 목록을 조회해 보증 유형 라벨 lookup용으로 반환.
 * 매칭 알고리즘에서 보증 유형별 라벨/필터 참조 시 사용.
 * @param supabase RLS 우회 가능한 클라이언트 또는 anon 클라이언트 (announcement_sources SELECT 가능해야 함)
 */
export async function getKoregProductsLookup(
  supabase: SupabaseClient | null
): Promise<KoregProductLookupItem[]> {
  if (!supabase) return [];

  const { data: rows, error } = await supabase
    .from("announcement_sources")
    .select("source_ann_id, raw_payload")
    .eq("source_name", SOURCE_NAME);

  if (error || !rows?.length) return [];
  return rows.map(rowToLookupItem);
}
