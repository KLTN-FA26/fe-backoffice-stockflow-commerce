/**
 * Goods receipt — lập phiếu theo Đơn sản xuất + kiểm đếm (SCRUM-566), khớp `GoodsReceiptController` của BE:
 * `POST /goods-receipts/production` (phiếu Draft, docs 03 §4.1 bước 1) và `PUT /goods-receipts/{id}/lines` (thay
 * toàn bộ bản đếm, bước 2). Tách khỏi `api.ts` để mỗi file ≤ 200 dòng. Parse tại biên như `api.ts`.
 */

import { api } from "@/lib/api/client";

import { postReceipt, receiptPath, toReceipt } from "./api";
import { beGoodsReceiptSchema } from "./schemas";

import type { GoodsReceipt, ProductionReceiptCreateInput, ReceiptLinesInput } from "./types";

/** BR-01 / BR-15 (docs 03 §6): BE chỉ nhận Đơn sản xuất nhận được hàng, ở kho người dùng được gán. */
export const createProductionReceipt = (input: ProductionReceiptCreateInput) =>
  postReceipt("/goods-receipts/production", {
    productionOrderId: input.productionOrderId,
    deliveryNote: input.deliveryNote || undefined,
    note: input.note || undefined,
  });

export interface ReplaceReceiptLinesVars {
  receiptId: string;
  body: ReceiptLinesInput;
}

/**
 * Lưu bản đếm — response có LPN của thùng mới (in nhãn từ đây). BR-02 / BR-13 BE kiểm lại, lỗi theo từng trường
 * (`lines[i]…`).
 */
export async function replaceReceiptLines({
  receiptId,
  body,
}: ReplaceReceiptLinesVars): Promise<GoodsReceipt> {
  const { data } = await api.put<unknown>(`${receiptPath(receiptId)}/lines`, body);
  return toReceipt(beGoodsReceiptSchema.parse(data));
}
