/**
 * Shipping — phần chung của ba bảng cấu hình hãng (lý do giao thất bại, mã dịch vụ, điểm lấy hàng): khoá dòng, kiểu lỗi theo
 * ô, kiểm ô mã. Pure — không gọi mạng. Dòng bỏ trống hoàn toàn (người dùng bấm "Thêm dòng" rồi bỏ đó) không tính và không
 * chặn lưu.
 */

import { CARRIER_CONFIG_LIMITS as L, CARRIER_CONFIG_MESSAGES as MSG } from "@/constants";

let keyCounter = 0;
/** Khoá React ổn định cho một dòng (không dùng chỉ số mảng vì dòng được xoá giữa chừng). */
export const newRowKey = (): string => `row-${(keyCounter += 1)}`;

/** Lỗi theo ô của một dòng: tên ô → câu tiếng Việt (`REQUIRED` = chỉ đánh dấu đỏ, không in chữ). */
export type RowErrors<Field extends string> = Partial<Record<Field, string>>;
/** Ô trống bắt buộc: chỉ đánh dấu đỏ ô đó, không in chữ dưới ô (dòng mới thêm chưa điền chưa phải lỗi to). */
export const REQUIRED = "required";

const PRINTABLE_NO_SPACE = /^[!-~]+$/;
export const isBlank = (value: string) => value.trim() === "";

/** Ô mã in được không khoảng trắng, độ dài ≤ `max` (BE `PROVINCE` / `CITY` / `SERVICE`). */
export function codeError(value: string, max: number): string | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return REQUIRED;
  if (trimmed.length > max) return MSG.tooLong;
  if (!PRINTABLE_NO_SPACE.test(trimmed)) return MSG.noSpaces;
  return undefined;
}

/** Có ô nào sai không (dùng để chặn nút Lưu). */
export function hasRowErrors(errors: readonly RowErrors<string>[]): boolean {
  return errors.some((row) => Object.keys(row).length > 0);
}

export const ROW_LIMITS = L;
export const ROW_MESSAGES = MSG;
