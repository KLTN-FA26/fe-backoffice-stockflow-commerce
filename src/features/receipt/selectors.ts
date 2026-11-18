/**
 * Goods receipt — selectors THUẦN (không side effect), derive từ data đã parse.
 */

import { RECEIPT_TYPE } from "@/constants";
import { toLocalIsoDate } from "@/lib/format/date";

import type { GoodsReceipt } from "./types";

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
