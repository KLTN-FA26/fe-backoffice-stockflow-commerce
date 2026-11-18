/**
 * Đọc từng ô của bảng EasyCargo cho "Ước tính thử" — các hàm nhỏ của `nesting-standalone/api/nesting/parsers.py`
 * (`_norm`, `_clean_text`, `_to_float`, `_to_bool`, `_unit_factor`), thuần, không file. Thêm `weightFactor` cho cột
 * "Total weight" (quyết định WF4-TRIAL-EST: bản Python không đọc khối lượng).
 */

import {
  TRIAL_DEFAULT_LENGTH_FACTOR,
  TRIAL_DEFAULT_WEIGHT_FACTOR,
  TRIAL_FALSE_VALUES,
  TRIAL_LENGTH_UNITS,
  TRIAL_WEIGHT_DECIMALS,
  TRIAL_WEIGHT_UNITS,
} from "@/constants";

export type TrialCell = string | number | boolean | Date | null | undefined;
export type TrialRow = readonly TrialCell[];

/**
 * Dòng thô của thư viện đọc xlsx → `TrialCell`. Thư viện khai báo kiểu ô ngày là `typeof Date` (hàm dựng) dù giá trị
 * thật là `Date`, nên chuẩn lại từng ô thay vì ép kiểu; ô lạ → null.
 */
export function normalizeRows(rows: readonly (readonly unknown[])[]): TrialCell[][] {
  return rows.map((row) =>
    row.map((value): TrialCell => {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
        return value;
      return value instanceof Date ? value : null;
    }),
  );
}

/** `_norm`: gộp khoảng trắng / xuống dòng, cắt hai đầu, chữ thường. */
export const norm = (value: TrialCell): string =>
  value === null || value === undefined
    ? ""
    : String(value).replace(/\s+/g, " ").trim().toLowerCase();

/** `_clean_text`: như `norm` nhưng giữ nguyên hoa thường. */
export const cleanText = (value: TrialCell): string =>
  value === null || value === undefined ? "" : String(value).replace(/\s+/g, " ").trim();

/** `_to_float`: số thường, dấu phẩy thập phân kiểu EU, đơn vị thừa ("90 cm"); không phải số → null. */
export function toFloat(value: TrialCell): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return Number(value);
  if (value instanceof Date) return null;
  let text = value.trim();
  if (!text) return null;
  text =
    text.includes(",") && !text.includes(".") ? text.replace(/,/g, ".") : text.replace(/,/g, "");
  const match = /-?\d+(?:\.\d+)?/.exec(text);
  return match ? Number(match[0]) : null;
}

/** `_to_bool`: ô trống → mặc định; "n/no/false/0/f/không/khong" → false; còn lại → true. */
export function toBool(value: TrialCell, fallback: boolean): boolean {
  const text = norm(value);
  return text === "" ? fallback : !TRIAL_FALSE_VALUES.includes(text);
}

/** `_unit_factor`: bí danh đầu tiên (theo thứ tự bảng) nằm trong chuỗi đơn vị. */
export function unitFactor(text: string): number {
  for (const [token, factor] of TRIAL_LENGTH_UNITS) if (text.includes(token)) return factor;
  return TRIAL_DEFAULT_LENGTH_FACTOR;
}

/** Hệ số ra kg của ô đơn vị dưới cột "Total weight" — cùng cách dò như `unitFactor`, mặc định kg. */
export function weightFactor(text: string): number {
  for (const [token, factor] of TRIAL_WEIGHT_UNITS) if (text.includes(token)) return factor;
  return TRIAL_DEFAULT_WEIGHT_FACTOR;
}

/** Kích thước ra mm nguyên (BE nhận mm nguyên), tối thiểu 1. */
export const toMm = (value: number, factor: number): number =>
  Math.max(1, Math.round(value * factor));

const WEIGHT_SCALE = 10 ** TRIAL_WEIGHT_DECIMALS;

/** Làm tròn kg tới 3 chữ số, như BE `@Digits(fraction = 3)`. */
export const roundKg = (kg: number): number => Math.round(kg * WEIGHT_SCALE) / WEIGHT_SCALE;

/** Tổng khối lượng ra kg; trống, không phải số, hay tròn về 0 → null. */
export function toKg(value: number | null, factor: number): number | null {
  if (value === null) return null;
  const kg = roundKg(value * factor);
  return kg > 0 ? kg : null;
}
