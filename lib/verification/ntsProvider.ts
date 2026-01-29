/**
 * 국세청 사업자등록 상태조회 OpenAPI Provider
 * - Swagger: https://infuser.odcloud.kr/api/stages/28493/api-docs
 * - Base URL: https://api.odcloud.kr/api/nts-businessman/v1/status
 * - 인증: query string serviceKey (NTS_BIZ_API_KEY), POST JSON body { b_no: [\"0000000000\"] }
 */

import type { BizVerificationProvider, VerifyBizResult } from "./bizProvider";
import { normalizeBizNo, isValidBizNoFormat } from "./bizProvider";

interface OdcloudStatusItem {
  b_no?: string;
  b_stt?: string;
  b_stt_cd?: string;
  tax_type?: string;
  tax_type_cd?: string;
  end_dt?: string;
  utcc_yn?: string;
  tax_type_change_dt?: string;
  invoice_apply_dt?: string;
  rbf_tax_type?: string;
  rbf_tax_type_cd?: string;
}

interface OdcloudStatusResponse {
  status_code?: string;
  match_cnt?: number;
  request_cnt?: number;
  data?: OdcloudStatusItem[];
}

function formatYmd(ymd?: string): string | null {
  if (!ymd) return null;
  const s = String(ymd);
  if (s.length === 8 && /^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  return s;
}

function mapStatus(item: OdcloudStatusItem | undefined, verifiedAt: string): VerifyBizResult {
  if (!item) {
    return {
      status: "unknown",
      message: "국세청 상태조회 결과를 찾을 수 없습니다.",
      verifiedAt,
    };
  }

  const notRegisteredMsg = "국세청에 등록되지 않은 사업자등록번호입니다";
  if (item.tax_type && item.tax_type.includes(notRegisteredMsg)) {
    return {
      status: "unknown",
      message: notRegisteredMsg,
      verifiedAt,
    };
  }

  const statusCd = item.b_stt_cd ?? "";
  const statusName = item.b_stt ?? "";
  let bizStatus: VerifyBizResult["status"] = "unknown";

  if (statusCd === "01" || statusName.includes("계속사업자")) {
    bizStatus = "active";
  } else if (statusCd === "02" || statusCd === "03" || statusName.includes("휴업") || statusName.includes("폐업")) {
    bizStatus = "closed";
  }

  const parts: string[] = [];
  if (statusName) parts.push(`납세자상태: ${statusName}`);
  if (item.tax_type) parts.push(`과세유형: ${item.tax_type}`);
  const endDt = formatYmd(item.end_dt);
  if (endDt && bizStatus === "closed") {
    parts.push(`폐업일자: ${endDt}`);
  }

  const message = parts.length > 0 ? parts.join(" · ") : "국세청 상태조회 결과를 확인했습니다.";

  return {
    status: bizStatus,
    message,
    verifiedAt,
  };
}

export const ntsBizProvider: BizVerificationProvider = {
  async verifyBizStatus(bizNo: string): Promise<VerifyBizResult> {
    const normalized = normalizeBizNo(bizNo);
    const verifiedAt = new Date().toISOString();

    if (!isValidBizNoFormat(normalized)) {
      return {
        status: "unknown",
        message: "사업자번호는 '-' 없이 10자리 숫자여야 합니다.",
        verifiedAt,
      };
    }

    const serviceKey = process.env.NTS_BIZ_API_KEY;
    if (!serviceKey) {
      return {
        status: "unknown",
        message: "국세청 상태조회 API 키가 설정되지 않아 자동 검증을 수행할 수 없습니다.",
        verifiedAt,
      };
    }

    try {
      const url = new URL("https://api.odcloud.kr/api/nts-businessman/v1/status");
      url.searchParams.set("serviceKey", serviceKey);
      url.searchParams.set("returnType", "JSON");

      const res = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ b_no: [normalized] }),
      });

      if (!res.ok) {
        return {
          status: "unknown",
          message: "국세청 상태조회 API 호출 중 오류가 발생했습니다.",
          verifiedAt,
        };
      }

      const data = (await res.json()) as OdcloudStatusResponse;
      const item = Array.isArray(data.data) ? data.data[0] : undefined;
      return mapStatus(item, verifiedAt);
    } catch {
      return {
        status: "unknown",
        message: "국세청 상태조회 API 응답을 처리하는 중 오류가 발생했습니다.",
        verifiedAt,
      };
    }
  },
};

