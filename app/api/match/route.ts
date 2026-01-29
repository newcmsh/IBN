/**
 * Open API: 기업 정보(회사명, 매출, 업태, 종목, 키워드)로 매칭 결과 반환
 * POST /api/match
 * Body: { companyName, revenue, bizType (string | string[]), items, industryKeywords?, estDate?, region?, certifications? }
 */

import { NextRequest, NextResponse } from "next/server";
import type { CompanyProfile, MatchingApiResponse } from "@/lib/types";
import { runFullMatching } from "@/lib/matching/algorithm";
import { getGrantAnnouncements } from "@/lib/data/grants";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyName, revenue, bizType, items, industryKeywords, estDate, region, certifications } = body;

    if (!companyName || revenue == null) {
      return NextResponse.json(
        { error: "companyName, revenue 필수입니다." },
        { status: 400 }
      );
    }
    const bizTypeArr = Array.isArray(bizType)
      ? (bizType as unknown[]).map((x) => String(x).trim()).filter(Boolean)
      : bizType != null && String(bizType).trim()
        ? [String(bizType).trim()]
        : [];
    const itemsArr = Array.isArray(items) ? items.map((x: unknown) => String(x).trim()).filter(Boolean) : [];
    if (bizTypeArr.length === 0 || itemsArr.length === 0) {
      return NextResponse.json(
        { error: "bizType(1개 이상), items(배열 1개 이상) 필수입니다." },
        { status: 400 }
      );
    }

    const company: CompanyProfile = {
      companyName: String(companyName).trim(),
      revenue: Number(revenue) || 0,
      bizType: bizTypeArr,
      items: itemsArr,
      industryKeywords: Array.isArray(industryKeywords) ? industryKeywords.map(String).filter(Boolean) : undefined,
      estDate: estDate || undefined,
      region: region ? String(region).trim() : undefined,
      certifications: Array.isArray(certifications) ? certifications.map(String) : undefined,
    };

    const announcements = await getGrantAnnouncements();
    const { recommended, rejected } = runFullMatching(company, announcements);

    const totalExpectedAmount = recommended.reduce((sum, m) => sum + m.expectedAmount, 0);
    const bestMatch = recommended[0] ?? null;

    const response: MatchingApiResponse = {
      companyName: company.companyName,
      recommended,
      rejected,
      bestMatch,
      totalExpectedAmount,
      matchCount: recommended.length,
    };

    return NextResponse.json(response);
  } catch (e) {
    console.error("Match API error:", e);
    return NextResponse.json({ error: "매칭 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
