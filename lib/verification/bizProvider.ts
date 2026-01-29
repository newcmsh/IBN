/**
 * 사업자상태 검증 Provider 인터페이스
 * 실제 홈택스/제공사 API는 미정 → Mock Provider로 인터페이스만 정의.
 * 추후 verifyBizStatus(bizNo)를 실제 API로 교체.
 */

export type BizStatus = "active" | "closed" | "unknown";

export interface VerifyBizResult {
  status: BizStatus;
  message: string;
  /** 검증 시각 (ISO) */
  verifiedAt?: string;
}

export interface BizVerificationProvider {
  verifyBizStatus(bizNo: string): Promise<VerifyBizResult>;
}

/** 사업자번호 정규화 (숫자만 10자리) */
export function normalizeBizNo(bizNo: string): string {
  const digits = bizNo.replace(/\D/g, "");
  return digits.slice(0, 10);
}

/** 10자리 사업자번호 형식 검사 */
export function isValidBizNoFormat(bizNo: string): boolean {
  const n = normalizeBizNo(bizNo);
  return n.length === 10 && /^\d{10}$/.test(n);
}

/**
 * Mock Provider — 실제 API 연동 전 테스트용
 * 규칙: 10자리이고 000으로 시작하지 않으면 active, 000으로 시작하면 closed, 그 외 unknown
 */
export const mockBizProvider: BizVerificationProvider = {
  async verifyBizStatus(bizNo: string): Promise<VerifyBizResult> {
    const n = normalizeBizNo(bizNo);
    const verifiedAt = new Date().toISOString();

    if (n.length !== 10) {
      return {
        status: "unknown",
        message: "사업자번호는 10자리 숫자입니다. 형식을 확인해 주세요.",
        verifiedAt,
      };
    }

    if (n.startsWith("000")) {
      return {
        status: "closed",
        message: "휴·폐업 상태로 확인되었습니다. 수동 입력으로 진행할 수 있습니다.",
        verifiedAt,
      };
    }

    // 테스트용: 1111111111 → closed
    if (n === "1111111111") {
      return {
        status: "closed",
        message: "휴·폐업 상태로 확인되었습니다. 수동 입력으로 진행할 수 있습니다.",
        verifiedAt,
      };
    }

    return {
      status: "active",
      message: "사업자상태가 정상으로 확인되었습니다.",
      verifiedAt,
    };
  },
};
