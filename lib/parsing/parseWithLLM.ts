/**
 * LLM 추상화: 원문 텍스트 → ParsedAnnouncement
 * 서버 전용: OPENAI_API_KEY, OPENAI_CHAT_MODEL은 process.env에서만 읽음. 키는 절대 로그에 출력하지 않음.
 */

import type { ParsedAnnouncement } from "./types";
import { buildParsingPrompt, MAX_INPUT_CHARS, PARSING_SYSTEM_PROMPT } from "./prompt";

export type LLMParser = (text: string) => Promise<ParsedAnnouncement | null>;

/**
 * 원문(또는 상세 본문) 텍스트를 LLM으로 파싱해 표준 스키마 + target_criteria 반환.
 * 서버 전용: OPENAI_API_KEY 등은 process.env에서만 읽음.
 */
export async function parseWithLLM(text: string): Promise<ParsedAnnouncement | null> {
  return parseWithOpenAI(text);
}

/** LLM 응답 본문에서 JSON 객체만 추출 (마크다운 코드블록 제거) */
export function extractJsonFromLLMResponse(body: string): Record<string, unknown> | null {
  const trimmed = body.trim();
  let jsonStr = trimmed;
  const codeBlock = /^```(?:json)?\s*([\s\S]*?)```\s*$/m.exec(trimmed);
  if (codeBlock) jsonStr = codeBlock[1].trim();
  const start = jsonStr.indexOf("{");
  const end = jsonStr.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(jsonStr.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** 한글 금액 문자열 → 원 단위 숫자 (억/만원/원 등) */
function parseAmountFromText(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (Number.isFinite(n)) return n;
  const s = String(v).trim();
  if (!s) return null;
  const match = s.match(/^([\d.,]+)\s*(억|만\s*원?|원)?$/);
  if (!match) return null;
  let val = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(val)) return null;
  const unit = (match[2] ?? "").replace(/\s/g, "");
  if (unit === "억") val *= 100_000_000;
  else if (unit === "만원" || unit === "만") val *= 10_000;
  return Math.floor(val);
}

/** 한글 기간 문자열 → 개월 수 (년/개월) */
function parseMonthsFromText(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (Number.isFinite(n)) return Math.floor(n);
  const s = String(v).trim();
  if (!s) return null;
  const yearMatch = s.match(/([\d.]+)\s*년/);
  const monthMatch = s.match(/([\d.]+)\s*개?월/);
  let months = 0;
  if (yearMatch) months += Number(yearMatch[1]) * 12;
  if (monthMatch) months += Number(monthMatch[1]);
  return Number.isFinite(months) && months > 0 ? Math.floor(months) : null;
}

/** ParsedAnnouncement 형태로 정규화 (스네이크·카멜 혼용 + 억/만원/개월/년 단위 변환) */
export function normalizeParsed(obj: Record<string, unknown> | null): ParsedAnnouncement | null {
  if (!obj || typeof obj !== "object") return null;

  const arr = (v: unknown): string[] | null =>
    Array.isArray(v) ? v.map((x) => (x != null ? String(x).trim() : "")).filter(Boolean) : null;
  const num = (v: unknown): number | null => (v != null && Number.isFinite(Number(v)) ? Number(v) : null);
  const str = (v: unknown): string | null => (v != null ? String(v).trim() || null : null);

  const rawMax = obj.max_amount ?? obj.maxAmount ?? obj.limitAmt;
  const max_amount = num(rawMax) ?? parseAmountFromText(rawMax);

  const rawMinAge = obj.min_age_months ?? obj.minAgeMonths;
  const rawMaxAge = obj.max_age_months ?? obj.maxAgeMonths;
  const min_age_months =
    num(rawMinAge) ??
    parseMonthsFromText(rawMinAge) ??
    (obj.min_age_years != null && Number.isFinite(Number(obj.min_age_years)) ? Number(obj.min_age_years) * 12 : null);
  const max_age_months =
    num(rawMaxAge) ??
    parseMonthsFromText(rawMaxAge) ??
    (obj.max_age_years != null && Number.isFinite(Number(obj.max_age_years)) ? Number(obj.max_age_years) * 12 : null);

  const rawGrace = obj.grace_months ?? obj.graceMonths ?? obj.grace_period_months;
  const rawRepay = obj.repay_months ?? obj.repayMonths;
  const grace_months = num(rawGrace) ?? parseMonthsFromText(rawGrace);
  const repay_months = num(rawRepay) ?? parseMonthsFromText(rawRepay);

  const allowed_biz_types = arr(obj.allowed_biz_types ?? obj.allowedBizTypes ?? obj.bizTypes) ?? null;
  const include_keywords = arr(obj.include_keywords ?? obj.includeKeywords ?? obj.keywords) ?? null;
  const exclude_keywords = arr(obj.exclude_keywords ?? obj.excludeKeywords) ?? null;
  const baseTarget =
    obj.target_criteria != null && typeof obj.target_criteria === "object" && !Array.isArray(obj.target_criteria)
      ? (obj.target_criteria as Record<string, unknown>)
      : {};

  return {
    title: str(obj.title ?? obj.bzopNm ?? obj.sj),
    agency: str(obj.agency ?? obj.orgNm ?? obj.instNm),
    url: str(obj.url ?? obj.link ?? obj.detailUrl),
    max_amount: max_amount ?? null,
    min_age_months: min_age_months ?? null,
    max_age_months: max_age_months ?? null,
    region_sido: arr(obj.region_sido ?? obj.regionSido ?? obj.regions) ?? null,
    region_sigungu: arr(obj.region_sigungu ?? obj.regionSigungu) ?? null,
    allowed_biz_types: allowed_biz_types ?? null,
    include_keywords: include_keywords ?? null,
    exclude_keywords: exclude_keywords ?? null,
    interest_rate_min: num(obj.interest_rate_min ?? obj.interestRateMin),
    interest_rate_max: num(obj.interest_rate_max ?? obj.interestRateMax),
    grace_months: grace_months ?? null,
    repay_months: repay_months ?? null,
    deadline_at: str(obj.deadline_at ?? obj.deadlineAt ?? obj.endDt),
    published_at: str(obj.published_at ?? obj.publishedAt ?? obj.regDt),
    target_criteria: {
      ...baseTarget,
      allowed_biz_types: allowed_biz_types ?? [],
      include_keywords: include_keywords ?? [],
      exclude_keywords: exclude_keywords ?? [],
    },
  };
}

/** OpenAI 구현 (서버 전용). API 키는 로그에 절대 출력하지 않음 */
async function parseWithOpenAI(text: string): Promise<ParsedAnnouncement | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("OPENAI_API_KEY 미설정. LLM 파싱 스킵.");
    return null;
  }

  const userContent = buildParsingPrompt(text, MAX_INPUT_CHARS);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini",
      messages: [
        { role: "system", content: PARSING_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      temperature: 0.1,
      max_tokens: 2000,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("OpenAI API error:", res.status, errText.slice(0, 200));
    return null;
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;

  const json = extractJsonFromLLMResponse(content);
  return normalizeParsed(json);
}
