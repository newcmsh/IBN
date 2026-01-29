/**
 * 공고 데이터 소스
 * 실제 연동 시 각 기관 Open API + API KEY로 교체
 * - 기업마당, 보조금24, 중진공, 소진공, 신보, 신보재단, 기술보증, K-Startup, NTIS, 고용노동부, 코트라, 한국무역협회
 */

import type { GrantAnnouncement, DataSource } from "@/lib/types";

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
    url: "https://www.kosbi.or.kr/example/tech-fund",
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
    url: "https://www.sbc.or.kr/example/stable-fund",
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
    url: "https://www.kibo.or.kr/example/guarantee",
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
    url: "https://www.k-startup.go.kr/example/venture",
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
    url: "https://www.ntis.go.kr/example/rd-support",
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
  // TODO: Supabase from grant_announcements 또는 각 기관 API 병렬 호출
  return SAMPLE_ANNOUNCEMENTS;
}

export { SAMPLE_ANNOUNCEMENTS };
