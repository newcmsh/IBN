/**
 * 숫자 → 한글 금액 읽기 (예: 1000000 → "일백만원")
 */

const DIGITS = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];

/** 0~9999 한글 읽기 (십·백·천 단위) */
function readUnder10000(n: number): string {
  if (n <= 0 || n >= 10000) return "";
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const hundred = Math.floor(n / 100);
  n %= 100;
  const ten = Math.floor(n / 10);
  const one = n % 10;
  let s = "";
  if (thousand) s += DIGITS[thousand] + "천";
  if (hundred) s += DIGITS[hundred] + "백";
  if (ten) s += DIGITS[ten] + "십";
  if (one) s += DIGITS[one];
  return s;
}

/**
 * 원 단위 금액을 한글로 읽기
 * 예: 1000000 → "일백만원", 100000000 → "일억원", 123456789 → "일억이천삼백사십오만육천칠백팔십구원"
 */
export function toKoreanWon(amount: number): string {
  if (amount <= 0 || !Number.isFinite(amount)) return "";
  const a = Math.floor(amount);
  if (a >= 100_000_000) {
    const eok = Math.floor(a / 100_000_000);
    const rest = a % 100_000_000;
    const man = Math.floor(rest / 10_000);
    const rem = rest % 10_000;
    let s = readUnder10000(eok) + "억";
    if (man) s += readUnder10000(man) + "만";
    if (rem) s += readUnder10000(rem);
    return s + "원";
  }
  if (a >= 10_000) {
    const man = Math.floor(a / 10_000);
    const rem = a % 10_000;
    let s = readUnder10000(man) + "만";
    if (rem) s += readUnder10000(rem);
    return s + "원";
  }
  return readUnder10000(a) + "원";
}

/** 숫자만 추출 후 천 단위 쉼표 포맷 (예: "1234567" → "1,234,567") */
export function formatRevenueDisplay(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits === "") return "";
  return Number(digits).toLocaleString("ko-KR");
}

/** 표시용 문자열에서 숫자만 반환 (예: "1,234,567" → 1234567) */
export function parseRevenueNumber(value: string): number {
  const digits = value.replace(/\D/g, "");
  return digits === "" ? 0 : Number(digits);
}
