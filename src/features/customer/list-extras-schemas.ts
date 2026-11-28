/**
 * Cột phụ của danh sách khách (audit bo-29, BE PR #497) — đọc MỘT lần cho cả trang, cạnh `GET /customers`, vì module
 * khách không đọc được tiền / chứng từ (module đơn và thanh toán phụ thuộc module khách, chiều ngược lại là vòng):
 * - `GET /orders/credit-positions?customerIds=…` (`customer-credit-profiles:READ`): mỗi phần tử như
 *   `GET /orders/credit-position/{customerId}` → dùng lại `creditPositionDtoSchema`;
 * - `GET /orders/sales-contacts?customerIds=…` (`customer-customers:READ`): người đã gửi báo giá / hợp đồng gần nhất của
 *   khách. KHÔNG phải "Sale phụ trách" — người phụ trách lưu trên chính dòng khách (`salesOwner*`, sales-owner); cột này
 *   giữ riêng, ẩn được (D9: đổi tên "Liên hệ gần nhất").
 */

import { z } from "zod";

import { creditPositionDtoSchema } from "./credit-profile-schemas";

/** Tối đa id một lần gọi (BE `Pages.MAX_PAGE_SIZE`; quá → 400 UNSUPPORTED_PARAMETER). */
export const LIST_EXTRAS_MAX_IDS = 200;

export const creditPositionListDtoSchema = z.array(creditPositionDtoSchema);

/** BE `SalesContactResponse`. `source` đọc lỏng (QUOTE | CONTRACT, có thể thêm loại sau). */
export const salesContactDtoSchema = z.object({
  customerId: z.string(),
  salesUserId: z.string().nullish(),
  salesName: z.string().nullish(),
  /** false = tài khoản đã khoá / vô hiệu: người đó không còn làm. */
  salesActive: z.boolean(),
  source: z.string(),
  documentNumber: z.string().nullish(),
  at: z.string().nullish(),
});

export const salesContactListDtoSchema = z.array(salesContactDtoSchema);
