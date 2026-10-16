/**
 * Lỗi BE theo dòng (thiếu tồn, `@Valid` fieldErrors) giữ NGOÀI lỗi RHF: `trigger("lines")` (kiểm lại
 * trùng dòng khi sửa dòng khác) thay cả cây lỗi `lines`, sẽ xoá lỗi đặt bằng `setError` dù dòng đó
 * chưa được sửa. Khoá `"<chỉ số>.<field>"`.
 */

import { ApiError } from "@/lib/api/error";
import { stockErrorsByLine, transferLineFieldErrors } from "@/features/transfer/errors";

export type LineField = "sku" | "lotNumber" | "quantity";
export type ServerLineErrors = Readonly<Record<string, string>>;

export const lineErrorKey = (index: number, field: LineField) => `${index}.${field}`;

const LINE_FIELDS: readonly string[] = ["sku", "lotNumber", "quantity"] satisfies LineField[];
const isLineField = (field: string): field is LineField => LINE_FIELDS.includes(field);

/** Lỗi lưu lệnh → lỗi theo dòng: `@Valid` fieldErrors + thiếu tồn (đúng dòng SKU + lô). */
export function serverLineErrorsFrom(
  error: unknown,
  lines: readonly { sku: string; lotNumber?: string | null }[],
): ServerLineErrors {
  const byLine: Record<string, string> = {};
  if (error instanceof ApiError) {
    for (const { index, field, message } of transferLineFieldErrors(error)) {
      if (isLineField(field)) byLine[lineErrorKey(index, field)] = message;
    }
  }
  for (const [index, message] of Object.entries(stockErrorsByLine(error, lines, "quantity"))) {
    byLine[lineErrorKey(Number(index), "quantity")] = message;
  }
  return byLine;
}

const indexOf = (key: string) => Number(key.split(".")[0]);

/** Người dùng sửa dòng `index` → bỏ lỗi máy chủ của dòng đó (các dòng khác giữ nguyên). */
export function clearLineErrors(errors: ServerLineErrors, index: number): ServerLineErrors {
  const entries = Object.entries(errors).filter(([key]) => indexOf(key) !== index);
  return entries.length === Object.keys(errors).length ? errors : Object.fromEntries(entries);
}

/** Xoá dòng `index` → bỏ lỗi của dòng đó, dồn chỉ số các dòng phía sau lên một. */
export function removeLineErrors(errors: ServerLineErrors, index: number): ServerLineErrors {
  return Object.fromEntries(
    Object.entries(errors).flatMap(([key, message]) => {
      const at = indexOf(key);
      if (at === index) return [];
      const field = key.slice(key.indexOf(".") + 1);
      return [[at > index ? `${at - 1}.${field}` : key, message]];
    }),
  );
}
