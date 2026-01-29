/**
 * 사업자상태 검증 모듈
 * Mock Provider 구조. 실제 홈택스/제공사 API 연동 시 BizVerificationProvider 구현체만 교체.
 */

export {
  mockBizProvider,
  normalizeBizNo,
  isValidBizNoFormat,
  type BizStatus,
  type VerifyBizResult,
  type BizVerificationProvider,
} from "./bizProvider";
