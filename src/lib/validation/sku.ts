/**
 * SKU — một định nghĩa duy nhất cho mọi form có ô SKU (biến thể, điều chỉnh tồn, chuyển kho, PO).
 *
 * Nguồn: BE `common.domain.Sku` — mọi `@ValidSku` đều hỏi lại chính value object này, nên không có
 * mẫu nào khác. Server `strip()` + `toUpperCase()` rồi mới so khớp `[A-Z0-9][A-Z0-9._-]{0,63}`:
 * dài 1–64 ký tự, chữ / số / '.' / '_' / '-', không bắt đầu bằng dấu phân cách, nhập chữ thường
 * vẫn hợp lệ. FE không được chặt hơn BE (ví dụ chặn `_` hay `.`) vì SKU sinh theo mã sản phẩm có
 * thể chứa chúng.
 */

import { z } from "zod";

export const SKU_MAX_LENGTH = 64;

/** Dạng người dùng gõ vào (chữ thường được chấp nhận — BE in hoa). */
export const SKU_INPUT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

/** Dạng chuẩn BE lưu (đã trim + in hoa). */
export const SKU_CODE_PATTERN = /^[A-Z0-9][A-Z0-9._-]{0,63}$/;

export const SKU_FORMAT_MESSAGE =
  "SKU gồm chữ, số, '.', '_', '-', bắt đầu bằng chữ hoặc số, tối đa 64 ký tự";

/** Ô SKU bắt buộc: trim, 1–64 ký tự đúng mẫu BE. */
export const skuSchema = (messages: { required?: string; format?: string } = {}) =>
  z
    .string()
    .trim()
    .min(1, messages.required ?? "Nhập mã SKU")
    .regex(SKU_INPUT_PATTERN, messages.format ?? SKU_FORMAT_MESSAGE);

/** Ô SKU tuỳ chọn (BE tự sinh khi bỏ trống): rỗng hợp lệ, có giá trị thì phải đúng mẫu. */
export const optionalSkuSchema = (messages: { format?: string } = {}) =>
  z
    .string()
    .trim()
    .refine((value) => value === "" || SKU_INPUT_PATTERN.test(value), {
      message: messages.format ?? SKU_FORMAT_MESSAGE,
    });
