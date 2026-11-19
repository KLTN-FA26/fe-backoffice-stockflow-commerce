/**
 * Goods receipt — selectors THUẦN (không side effect), derive từ data đã parse.
 */

import { RECEIPT_TYPE } from "@/constants";
import { toLocalIsoDate } from "@/lib/format/date";

import type { GoodsReceipt, GoodsReceiptRow } from "./types";

/** Ngày nhận theo giờ VN (yyyy-MM-dd). */
export function receiptReceivedOn(receipt: Pick<GoodsReceipt, "receivedAt">): string {
  return toLocalIsoDate(receipt.receivedAt);
}

export function totalReceivedQuantity(receipt: Pick<GoodsReceipt, "lines">): number {
  return receipt.lines.reduce((sum, line) => sum + line.quantity, 0);
}

/**
 * Phiếu mua hàng cũ (`PURCHASE`): BE 4A-8 chỉ còn cho đọc và huỷ phiếu chưa ghi nhận — không xác nhận được nữa.
 */
export function isLegacyPurchaseReceipt(receipt: Pick<GoodsReceipt, "receiptType">): boolean {
  return receipt.receiptType === RECEIPT_TYPE.PURCHASE;
}

/**
 * Mã Đơn sản xuất cho bộ lọc `?productionOrder=<id>`: URL chỉ mang id (BE lọc theo `productionOrderId`), mã lấy từ
 * dòng danh sách khớp id đó. Chưa có dòng nào (đang tải, không phiếu nào khớp) → null, màn hình hiện id.
 */
export function productionOrderCodeOf(
  rows: readonly Pick<GoodsReceiptRow, "productionOrderId" | "productionOrderCode">[],
  productionOrderId: string,
): string | null {
  if (!productionOrderId) return null;
  return (
    rows.find((row) => row.productionOrderId === productionOrderId)?.productionOrderCode ?? null
  );
}
