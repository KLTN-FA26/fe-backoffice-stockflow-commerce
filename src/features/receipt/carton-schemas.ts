/**
 * Goods receipt — DTO thùng có LPN và đơn vị của dòng (BE `GoodsReceiptResponse.Package` / `.Unit`, SCRUM-473).
 * Tách khỏi `schemas.ts` để file giữ ≤ 200 dòng; `beReceiptLineSchema` dùng lại hai schema này.
 */

import { z } from "zod";

import { STOCK_PACKAGE_API_STATUSES } from "@/constants";

/**
 * BE `GoodsReceiptResponse.Package` (SCRUM-473) — một thùng có LPN. `quantity`: trong thùng hiện còn (lúc đếm =
 * số đếm); `receivedQty`: số đếm lúc nhận, chốt khi vào kho; `nominalQty`: sức chứa theo đơn vị đóng gói;
 * `locationCode`: khu nhận → khu QC / cách ly → bin. Thùng VOID không được trả.
 */
export const beReceiptPackageSchema = z.object({
  id: z.string(),
  lpn: z.string(),
  quantity: z.number().int().min(0),
  receivedQty: z.number().int().min(0),
  nominalQty: z.number().int().positive(),
  status: z.enum(STOCK_PACKAGE_API_STATUSES),
  locationCode: z.string().nullish(),
});

/**
 * BE `GoodsReceiptResponse.Unit` — mọi đơn vị của mặt hàng trên dòng (đơn vị cơ sở trước, rồi theo mã): nguồn của
 * ô chọn đơn vị thùng, để NV kho không cần quyền sản phẩm. `factor` = số đơn vị cơ sở trong một thùng.
 */
export const beReceiptUnitSchema = z.object({
  unitOfMeasure: z.string(),
  factor: z.number().int().positive(),
  base: z.boolean(),
  active: z.boolean(),
  defaultPurchase: z.boolean(),
});
