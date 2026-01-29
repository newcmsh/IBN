/**
 * 신용보증재단중앙회(KOREG) 재보증 상품 목록 OpenAPI 수집
 * GET /api/ingest/koreg/products
 * - 상품명, 상품순번, 보증유형, 주상품여부 포함
 * - announcement_sources에만 저장 (source_name='koreg_product', source_ann_id=상품순번)
 * - KOREG_PRODUCT_API_BASE_URL, KOREG_PRODUCT_API_KEY 사용 (서버 전용, 노출 금지)
 * - 기업 식별 정보 없음 → 개인정보 이슈 없음
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { parseApiResponse } from "@/lib/ingest/parseResponse";
import {
  SOURCE_NAME,
  extractProductsFromResponse,
  toSourceAnnId,
  type KoregProductRawItem,
} from "@/lib/ingest/koregProducts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(_request: NextRequest) {
  const baseUrl = process.env.KOREG_PRODUCT_API_BASE_URL?.trim();
  const apiKey = process.env.KOREG_PRODUCT_API_KEY;

  if (!baseUrl) {
    return NextResponse.json(
      { error: "KOREG_PRODUCT_API_BASE_URL이 설정되지 않았습니다." },
      { status: 500 }
    );
  }
  if (!apiKey) {
    return NextResponse.json(
      { error: "KOREG_PRODUCT_API_KEY가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  const url = new URL(baseUrl);
  url.searchParams.set("serviceKey", apiKey);
  url.searchParams.set("returnType", "JSON");

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json, application/xml, text/xml, */*" },
      next: { revalidate: 0 },
    });
  } catch {
    console.error("KOREG product API fetch error");
    return NextResponse.json(
      { error: "KOREG 재보증 상품 API 요청에 실패했습니다.", detail: "FETCH_ERROR" },
      { status: 502 }
    );
  }

  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();

  if (!res.ok) {
    return NextResponse.json(
      { error: "KOREG 재보증 상품 API 오류", status: res.status, body: text.slice(0, 500) },
      { status: 502 }
    );
  }

  const parsed = parseApiResponse(text, contentType);
  if (parsed == null) {
    return NextResponse.json(
      { error: "API 응답 파싱 실패 (JSON/XML 형식 확인)" },
      { status: 502 }
    );
  }

  const items = extractProductsFromResponse(parsed);
  if (items.length === 0) {
    return NextResponse.json({
      ok: true,
      message: "수집된 상품이 없습니다.",
      processed: 0,
      rows: 0,
    });
  }

  const admin = supabaseAdmin;
  if (!admin) {
    return NextResponse.json(
      { error: "Supabase Admin(SUPABASE_SERVICE_ROLE_KEY) 미설정. DB 저장 불가." },
      { status: 500 }
    );
  }

  let processed = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i] as KoregProductRawItem;
    const source_ann_id = toSourceAnnId(item, i);

    const { error } = await admin
      .from("announcement_sources")
      .upsert(
        {
          source_name: SOURCE_NAME,
          source_ann_id,
          raw_payload: item as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "source_name,source_ann_id" }
      );

    if (!error) processed++;
  }

  return NextResponse.json({
    ok: true,
    message: "KOREG 재보증 상품 수집 완료",
    processed,
    rows: items.length,
  });
}
