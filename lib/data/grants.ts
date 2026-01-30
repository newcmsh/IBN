/**
 * 공고 데이터 소스
 * 실제 연동 시 각 기관 Open API + API KEY로 교체
 * - 기업마당, 보조금24, 중진공, 소진공, 신보, 신보재단, 기술보증, K-Startup, NTIS, 고용노동부, 코트라, 한국무역협회
 */

import type { GrantAnnouncement, TargetCriteria, DataSource } from "@/lib/types";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** 샘플 공고 (개발/데모용). url·publishedAt/startAt/deadlineAt·targetCriteria */
const SAMPLE_ANNOUNCEMENTS: GrantAnnouncement[] = [
  {
    annId: "kosbi-2024-001",
    agency: "중소벤처기업진흥공단",
    title: "중소기업 기술개발 자금 지원",
    maxAmount: 500_000_000,
    interestRate: 1.5,
    gracePeriodMonths: 12,
    source: "kosbi",
    publishedAt: "2026-01-05",
    startAt: "2026-01-10",
    deadlineAt: "2026-02-05",
    targetCriteria: {
      minRevenue: 100_000_000,
      maxRevenue: 50_000_000_000,
      minYears: 1,
      maxYears: 20,
      allowed_biz_types: ["제조", "서비스", "건설"],
      include_keywords: ["제조업", "기술개발", "제조"],
      exclude_keywords: ["유통", "도매"],
    },
  },
  {
    annId: "sbc-2024-002",
    agency: "소상공인시장진흥공단",
    title: "소상공인 경영안정 자금",
    maxAmount: 100_000_000,
    interestRate: 2.0,
    gracePeriodMonths: 6,
    source: "sbc",
    publishedAt: "2026-01-01",
    startAt: "2026-01-08",
    deadlineAt: "2026-01-25",
    targetCriteria: {
      maxRevenue: 800_000_000,
      maxYears: 7,
      allowed_biz_types: ["도소매", "서비스"],
      include_keywords: ["소상공인", "경영"],
      exclude_keywords: ["제조"],
    },
  },
  {
    annId: "kibo-2024-003",
    agency: "신용보증기금",
    title: "일반 보증 지원",
    maxAmount: 300_000_000,
    interestRate: 2.5,
    gracePeriodMonths: 12,
    source: "kibo",
    publishedAt: "2025-12-15",
    deadlineAt: "2026-03-31",
    targetCriteria: { allowed_biz_types: [], include_keywords: [], exclude_keywords: [] },
  },
  {
    annId: "kstartup-2024-004",
    agency: "K-Startup",
    title: "벤처 성장 자금",
    maxAmount: 1_000_000_000,
    interestRate: 1.0,
    gracePeriodMonths: 24,
    source: "kstartup",
    publishedAt: "2026-01-01",
    startAt: "2026-01-15",
    deadlineAt: "2026-02-28",
    targetCriteria: {
      requiredCerts: ["벤처"],
      minYears: 0,
      maxYears: 7,
      allowed_biz_types: ["제조", "서비스"],
      include_keywords: ["벤처", "스타트업"],
      exclude_keywords: [],
    },
  },
  {
    annId: "ntis-2024-005",
    agency: "NTIS R&D",
    title: "중소기업 R&D 지원",
    maxAmount: 200_000_000,
    interestRate: 0,
    gracePeriodMonths: 36,
    source: "ntis",
    publishedAt: "2025-12-20",
    startAt: "2026-01-01",
    deadlineAt: "2026-01-31",
    targetCriteria: {
      minRevenue: 50_000_000,
      allowed_biz_types: ["제조", "서비스"],
      include_keywords: ["연구", "개발", "R&D"],
      exclude_keywords: [],
    },
  },
];

/** 공고 목록 반환. 추후 Supabase 또는 외부 API 호출로 대체 */
export async function getGrantAnnouncements(): Promise<GrantAnnouncement[]> {
  // Supabase grant_announcements(수집된 실제 데이터)가 있으면 우선 사용
  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from("grant_announcements")
        .select(
          "source_name,source_ann_id,agency,title,max_amount,url,published_at,deadline_at,interest_rate,grace_period_months,target_criteria"
        )
        // 기본 정렬: 최신 게시일 우선 (없으면 created_at 기준이지만 여기선 생략)
        .order("published_at", { ascending: false, nullsFirst: false })
        .range(0, 999);

      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map((row) => {
          const sourceName = String((row as any).source_name || "bizinfo");
          const source = sourceName as DataSource;
          const sourceAnnId = String((row as any).source_ann_id || "");
          const publishedAt = (row as any).published_at ? new Date((row as any).published_at).toISOString() : undefined;
          const deadlineAt = (row as any).deadline_at ? new Date((row as any).deadline_at).toISOString() : undefined;

          const targetCriteria = ((row as any).target_criteria ?? {}) as TargetCriteria;

          return {
            annId: `${sourceName}:${sourceAnnId}`,
            agency: String((row as any).agency || sourceName),
            title: String((row as any).title || "공고"),
            maxAmount: Number((row as any).max_amount ?? 0) || 0,
            targetCriteria,
            interestRate:
              (row as any).interest_rate != null ? Number((row as any).interest_rate) : undefined,
            gracePeriodMonths:
              (row as any).grace_period_months != null ? Number((row as any).grace_period_months) : undefined,
            source,
            url: (row as any).url ? String((row as any).url) : undefined,
            // DB에는 start_at 컬럼이 없으므로 published_at을 startAt으로도 사용
            publishedAt,
            startAt: publishedAt,
            deadlineAt,
          } satisfies GrantAnnouncement;
        });
      }
      // Supabase가 연결되어 있는데 공고가 0건이면 샘플을 섞지 않고 빈 배열 반환(혼동 방지)
      if (!error && Array.isArray(data) && data.length === 0) return [];
    } catch {
      // 실패 시 샘플로 fallback
    }
  }

  // fallback: 샘플 (데모용)
  return SAMPLE_ANNOUNCEMENTS;
}

export { SAMPLE_ANNOUNCEMENTS };
