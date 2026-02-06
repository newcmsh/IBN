/**
 * Open API: 기업 정보(회사명, 매출, 업태, 종목, 키워드)로 매칭 결과 반환
 * POST /api/match
 * Body: { companyName, revenue, bizType (string | string[]), items, industryKeywords?, estDate?, zipcode?, address1?, address2?, regionSido?, regionSigungu?, certifications? }
 */

import { NextRequest, NextResponse } from "next/server";
import type { CompanyProfile, MatchingApiResponse } from "@/lib/types";
import { runFullMatching } from "@/lib/matching/algorithm";
import { getGrantAnnouncementsWithSource } from "@/lib/data/grants";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      companyName,
      revenue,
      bizType,
      items,
      industryKeywords,
      estDate,
      zipcode,
      address1,
      address2,
      regionSido,
      regionSigungu,
      certifications,
      penalties,
    } = body;

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
      zipcode: zipcode ? String(zipcode).trim() : undefined,
      address1: address1 ? String(address1).trim() : undefined,
      address2: address2 ? String(address2).trim() : undefined,
      regionSido: regionSido ? String(regionSido).trim() : undefined,
      regionSigungu: regionSigungu ? String(regionSigungu).trim() : undefined,
      // 레거시 호환: 기존 로직이 region을 참조하는 경우를 대비
      region: regionSido ? String(regionSido).trim() : undefined,
      certifications: Array.isArray(certifications) ? certifications.map(String) : undefined,
      penalties: penalties && typeof penalties === "object" ? (penalties as any) : undefined,
    };

    const { announcements, source } = await getGrantAnnouncementsWithSource();
    const { recommended, rejected } = runFullMatching(company, announcements);

    const totalExpectedAmount = recommended.reduce((sum, m) => sum + m.expectedAmount, 0);
    const bestMatch = recommended[0] ?? null;

    const response: MatchingApiResponse = {
      companyName: company.companyName,
      regionSido: company.regionSido,
      regionSigungu: company.regionSigungu,
      recommended,
      rejected,
      bestMatch,
      totalExpectedAmount,
      matchCount: recommended.length,
      _meta: { announcementsSource: source, announcementsCount: announcements.length },
    };

    return NextResponse.json(response);
  } catch (e) {
    console.error("Match API error:", e);
    return NextResponse.json({ error: "매칭 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
