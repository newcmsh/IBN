/**
 * 공고 원문 파싱 + grant_announcements 배치 upsert
 * announcement_sources의 raw_payload(원문) → 텍스트 추출 → parseWithLLM → grant_announcements upsert
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { parseWithLLM } from "./parseWithLLM";
import { MAX_INPUT_CHARS } from "./prompt";
import type { ParsedAnnouncement } from "./types";

/** 원문 텍스트 fallback(JSON stringify) 상한 (비용 보호) */
const RAW_FALLBACK_MAX_CHARS = 20_000;

/** announcement_sources.raw_payload(JSONB)에서 LLM 입력용 텍스트 추출. content/body/detail/description 등 우선, 없으면 JSON stringify */
export function extractTextFromRawPayload(raw: Record<string, unknown> | null): string {
  if (!raw || typeof raw !== "object") return "";
  const o = raw as Record<string, unknown>;
  const candidates = [
    o.content,
    o.body,
    o.detail,
    o.description,
    o.fullText,
    o.text,
    o.본문,
    o.상세내용,
    o.공고내용,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim().slice(0, MAX_INPUT_CHARS);
  }
  return JSON.stringify(o, null, 0).slice(0, RAW_FALLBACK_MAX_CHARS);
}

export interface ParseBatchEntry {
  source_name: string;
  source_ann_id: string;
  /** 원문 또는 상세 본문 텍스트 (raw_payload에서 추출한 문자열) */
  text: string;
}

export interface ParseBatchResult {
  ok: number;
  fail: number;
  errors: Array<{ source_name: string; source_ann_id: string; error: string }>;
}

/** limit 기본값/최대값 (과금 폭주 방지) */
export const PARSE_LIMIT_DEFAULT = 20;
export const PARSE_LIMIT_MAX = 100;

export interface BatchParseFromSourceOptions {
  source_name: string;
  limit?: number;
  since?: string;
}

export interface BatchParseFromSourceResult {
  processed: number;
  success: number;
  failed: number;
  failures: Array<{ source_ann_id: string; reason: string }>;
  /** DB 조회 실패 시 메시지 */
  fetchError?: string;
}

/**
 * announcement_sources에서 source_name 기준 최근 n건 조회 후 파싱·upsert.
 * limit 기본 20, 최대 100. since(ISO 문자열) 있으면 updated_at >= since만 조회.
 */
export async function batchParseAndUpsertFromSource(
  options: BatchParseFromSourceOptions,
  supabaseAdmin: SupabaseClient | null
): Promise<BatchParseFromSourceResult> {
  const limit = Math.min(Math.max(options.limit ?? PARSE_LIMIT_DEFAULT, 1), PARSE_LIMIT_MAX);
  const result: BatchParseFromSourceResult = { processed: 0, success: 0, failed: 0, failures: [] };

  if (!supabaseAdmin) {
    return result;
  }

  let query = supabaseAdmin
    .from("announcement_sources")
    .select("source_name, source_ann_id, raw_payload, updated_at")
    .eq("source_name", options.source_name)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (options.since) {
    query = query.gte("updated_at", options.since);
  }

  const { data: rows, error: fetchError } = await query;

  if (fetchError) {
    result.fetchError = fetchError.message;
    return result;
  }

  const entries: ParseBatchEntry[] = (rows ?? []).map(
    (r: { source_name: string; source_ann_id: string; raw_payload: Record<string, unknown> }) => ({
      source_name: r.source_name,
      source_ann_id: r.source_ann_id,
      text: extractTextFromRawPayload(r.raw_payload ?? null),
    })
  );

  result.processed = entries.length;
  if (entries.length === 0) return result;

  const batchResult = await batchParseAndUpsert(entries, supabaseAdmin);
  result.success = batchResult.ok;
  result.failed = batchResult.fail;
  result.failures = batchResult.errors.map((e) => ({ source_ann_id: e.source_ann_id, reason: e.error }));
  return result;
}

/**
 * 원문 텍스트 목록을 LLM으로 파싱한 뒤 grant_announcements에 upsert.
 * 서버 전용: parseWithLLM 내부에서 OPENAI_API_KEY 등 process.env 사용.
 *
 * @param entries source_name, source_ann_id, text(원문/본문)
 * @param supabaseAdmin RLS 우회용 Supabase 클라이언트(서비스 롤)
 */
export async function batchParseAndUpsert(
  entries: ParseBatchEntry[],
  supabaseAdmin: SupabaseClient | null
): Promise<ParseBatchResult> {
  const result: ParseBatchResult = { ok: 0, fail: 0, errors: [] };

  if (!supabaseAdmin) {
    result.fail = entries.length;
    result.errors = entries.map((e) => ({
      source_name: e.source_name,
      source_ann_id: e.source_ann_id,
      error: "Supabase Admin 미설정",
    }));
    return result;
  }

  for (const entry of entries) {
    const { source_name, source_ann_id, text } = entry;
    if (!text?.trim()) {
      result.fail++;
      result.errors.push({ source_name, source_ann_id, error: "원문 텍스트 없음" });
      continue;
    }

    let parsed: ParsedAnnouncement | null = null;
    try {
      parsed = await parseWithLLM(text);
    } catch (e) {
      result.fail++;
      result.errors.push({
        source_name,
        source_ann_id,
        error: e instanceof Error ? e.message : String(e),
      });
      continue;
    }

    if (!parsed) {
      result.fail++;
      result.errors.push({ source_name, source_ann_id, error: "LLM 파싱 결과 없음" });
      continue;
    }

    const row = toGrantAnnouncementRow(source_name, source_ann_id, parsed);
    const { error } = await supabaseAdmin
      .from("grant_announcements")
      .upsert(row, { onConflict: "source_name,source_ann_id" });

    if (error) {
      result.fail++;
      result.errors.push({ source_name, source_ann_id, error: error.message });
    } else {
      result.ok++;
    }
  }

  return result;
}

/** ParsedAnnouncement → grant_announcements insert/upsert 행 (업태/키워드 기반 target_criteria) */
function toGrantAnnouncementRow(
  source_name: string,
  source_ann_id: string,
  p: ParsedAnnouncement
): Record<string, unknown> {
  const target_criteria = (p.target_criteria ?? {}) as Record<string, unknown>;
  return {
    source_name,
    source_ann_id,
    title: p.title ?? "제목없음",
    agency: p.agency ?? "기관미상",
    max_amount: p.max_amount ?? 0,
    url: p.url ?? null,
    min_age_months: p.min_age_months ?? null,
    max_age_months: p.max_age_months ?? null,
    region_sido: p.region_sido ?? [],
    region_sigungu: p.region_sigungu ?? [],
    interest_rate_min: p.interest_rate_min ?? null,
    interest_rate_max: p.interest_rate_max ?? null,
    grace_months: p.grace_months ?? null,
    repay_months: p.repay_months ?? null,
    deadline_at: p.deadline_at ?? null,
    published_at: p.published_at ?? null,
    target_criteria: {
      ...target_criteria,
      allowed_biz_types: p.allowed_biz_types ?? target_criteria.allowed_biz_types ?? [],
      include_keywords: p.include_keywords ?? target_criteria.include_keywords ?? [],
      exclude_keywords: p.exclude_keywords ?? target_criteria.exclude_keywords ?? [],
    },
    interest_rate: p.interest_rate_min ?? p.interest_rate_max ?? null,
    grace_period_months: p.grace_months ?? null,
    updated_at: new Date().toISOString(),
  };
}
