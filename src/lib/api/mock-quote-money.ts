/**
 * Tiền và chữ trong thông báo của mock WF-02 — làm tròn y như BE (`Vat.of`, `ContractTerms.plan`, `OrderLine.grossOf`:
 * HALF_UP tới đồng) và in số / ngày như `MessageFormat` của Spring với locale `vi` (dấu chấm ngăn nghìn, `dd/MM/yyyy`).
 * Tính bằng BigInt để tích tiền × phần trăm không vượt số nguyên an toàn của JavaScript.
 */

const ZONE = "Asia/Ho_Chi_Minh";
const TEN_THOUSAND = BigInt(10_000);
const TWO = BigInt(2);

/** `a × b / c`, HALF_UP tới số nguyên — mọi số là số nguyên không âm, `c > 0`. */
export function mulDivHalfUp(a: number, b: number, c: number): number {
  const product = BigInt(Math.round(a)) * BigInt(Math.round(b));
  const divisor = BigInt(Math.round(c));
  const quotient = product / divisor;
  const remainder = product % divisor;
  return Number(remainder * TWO >= divisor ? quotient + BigInt(1) : quotient);
}

/** `amount × percent / 100`, HALF_UP tới đồng; `percent` tối đa 2 số lẻ (BE `Vat.of`, đợt thanh toán theo %). */
export function percentOf(amount: number, percent: number): number {
  return mulDivHalfUp(amount, Math.round(percent * 100), Number(TEN_THOUSAND));
}

/** Số như Spring `MessageFormat` locale `vi`: `76.140.000`. */
export const viNumber = (value: number): string => new Intl.NumberFormat("vi-VN").format(value);

/** Ngày `YYYY-MM-DD` → `dd/MM/yyyy` (BE `SalesContract.DAY`). */
export const viDay = (day: string): string => day.split("-").reverse().join("/");

/** Thời điểm → `dd/MM/yyyy HH:mm` giờ Việt Nam (BE `Quote.VALID_UNTIL`). */
export const viDateTime = (iso: string): string =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(new Date(iso))
    .replace(",", "");

/** Số nguyên dương / không âm đọc từ body JSON (`unknown`); khác → null. */
export function wholeNumber(value: unknown, min: number): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= min ? value : null;
}
