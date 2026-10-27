/**
 * Số thập phân dạng CHUỖI cho tiền BE `BigDecimal`. JSON number đi qua `JSON.parse` thành số thực
 * IEEE-754 của trình duyệt (~15–17 chữ số có nghĩa), nên tiền được giữ là chuỗi chữ số, không tính toán
 * số thực, và chỉ đổi sang `Number` lúc tuần tự hoá khi `travelsExactly` — giá trị JSON không chở nguyên
 * vẹn được thì chặn, không làm tròn ngầm. Dùng chung cho mọi feature (không import chéo feature).
 */

/** Chữ số thập phân không dấu, không số mũ ("12", "12.50"). */
export const DECIMAL_TEXT = /^\d+(\.\d+)?$/;

/** Dạng chuẩn như BE `stripTrailingZeros()`: bỏ 0 đầu phần nguyên và 0 cuối phần lẻ ("007.50" → "7.5"). */
export function canonicalDecimal(raw: string): string {
  const [whole = "", fraction = ""] = raw.split(".");
  const int = whole.replace(/^0+(?=\d)/, "");
  const frac = fraction.replace(/0+$/, "");
  return frac === "" ? int : `${int}.${frac}`;
}

/**
 * Chuỗi thập phân chuẩn có đi qua JSON number mà không đổi không. `Number` → double → `JSON.stringify`
 * in dạng ngắn nhất; khớp lại đúng chuỗi thì BE (đọc `BigDecimal` từ chữ số JSON) nhận đúng giá đã nhập.
 */
export function travelsExactly(canonical: string): boolean {
  return String(Number(canonical)) === canonical;
}
