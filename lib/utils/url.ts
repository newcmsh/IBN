import type { GrantAnnouncement } from "@/lib/types";

function safeLower(s: string): string {
  return s.trim().toLowerCase();
}

export function toHttpUrlOrNull(raw?: string | null): URL | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u;
  } catch {
    return null;
  }
}

function looksLikeExampleOrPlaceholder(u: URL): boolean {
  const full = safeLower(u.toString());
  if (full.includes("/example/")) return true;
  if (full.includes("placeholder")) return true;
  if (full.includes("your-project") || full.includes("your-domain")) return true;
  if (full.includes("localhost")) return true;
  return false;
}

function looksLikeRootOrMainPath(u: URL): boolean {
  const p = safeLower(u.pathname);
  if (p === "/" || p === "") return true;
  if (/^\/(main|index|home)(\/|$|\.)/.test(p)) return true;
  return false;
}

function containsAnnouncementHint(u: URL, ann: Pick<GrantAnnouncement, "annId" | "source" | "title">): boolean {
  const full = u.toString();
  const tokens: string[] = [];
  if (ann.annId) tokens.push(ann.annId);
  if (ann.source) tokens.push(String(ann.source));

  // 제목에서 너무 짧은 토큰은 제외
  const title = (ann.title ?? "").trim();
  if (title) {
    title
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3)
      .slice(0, 3)
      .forEach((t) => tokens.push(t));
  }

  return tokens.some((t) => t && full.includes(t));
}

/**
 * 공고 URL이 "예시/placeholder"로 보이는지 간단 판정.
 * - /example/ 포함
 * - localhost / your-project 등
 * - 루트/메인(/, /main, /index 등) 형태 + 쿼리 없음 + annId/source/title 힌트 없음
 */
export function isPlaceholderAnnouncementUrl(raw: string | undefined | null, ann: GrantAnnouncement): boolean {
  const u = toHttpUrlOrNull(raw);
  if (!u) return true; // 파싱 불가면 사용하지 않음
  if (looksLikeExampleOrPlaceholder(u)) return true;

  const hasQuery = u.search && u.search.length > 1;
  if (looksLikeRootOrMainPath(u) && !hasQuery && !containsAnnouncementHint(u, ann)) return true;

  return false;
}

export interface AnnouncementViewLink {
  href: string;
  from: "url" | "sourceUrl";
}

/** UI에서 사용할 바로보기 링크 선택: url(유효) → sourceUrl(유효) → null */
export function pickAnnouncementViewLink(ann: GrantAnnouncement): AnnouncementViewLink | null {
  if (ann.url && !isPlaceholderAnnouncementUrl(ann.url, ann)) {
    const u = toHttpUrlOrNull(ann.url);
    if (u) return { href: u.toString(), from: "url" };
  }
  if (ann.sourceUrl && !isPlaceholderAnnouncementUrl(ann.sourceUrl, ann)) {
    const u = toHttpUrlOrNull(ann.sourceUrl);
    if (u) return { href: u.toString(), from: "sourceUrl" };
  }
  return null;
}

