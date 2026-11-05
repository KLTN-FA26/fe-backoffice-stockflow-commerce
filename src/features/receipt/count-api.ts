/**
 * Goods receipt — kiểm đếm phiếu DRAFT: `PUT /goods-receipts/{id}/lines` thay toàn bộ dòng (BE `ReceiptLinesRequest`),
 * kèm thùng có LPN (SCRUM-473). Parse tại biên như `api.ts`.
 */

import { api } from "@/lib/api/client";
import { idempotencyRequestConfig } from "@/lib/api/idempotency";

import { emptyToUndefined, receiptPath, toReceipt } from "./api";
import { beGoodsReceiptSchema } from "./schemas";

import type {
  GoodsReceipt,
  PackageInputValues,
  SaveBlindLinesInput,
  SaveReceiptLinesInput,
} from "./types";

/**
 * Thùng của một dòng (SCRUM-473 §3): LUÔN gửi đủ danh sách — thùng có `lpn` đếm lại, không `lpn` là thùng mới, thùng
 * vắng mặt bị VOID. `packages: []` = dòng lẻ (thùng cũ nếu có cũng VOID — đúng ý form).
 */
function cartonFields(line: { unitOfMeasure: string; packages: readonly PackageInputValues[] }) {
  return {
    // Đơn vị đóng gói mà không có thùng bị BE từ chối (RECEIPT_LINE_UNIT_INVALID): dòng lẻ không gửi đơn vị
    unitOfMeasure: line.packages.length > 0 ? emptyToUndefined(line.unitOfMeasure) : undefined,
    packages: line.packages.map(({ lpn, quantity }) => (lpn ? { lpn, quantity } : { quantity })),
  };
}

/** Thay toàn bộ kiểm đếm của phiếu không có PO: dòng gọi hàng bằng `sku` (không có `purchaseOrderLineId`). */
export async function replaceBlindReceiptLines({
  receiptId,
  lines,
  idempotencyKey,
}: SaveBlindLinesInput): Promise<GoodsReceipt> {
  const { data } = await api.put<unknown>(
    `${receiptPath(receiptId)}/lines`,
    {
      lines: lines.map((line) => ({
        sku: line.sku,
        quantity: line.quantity,
        lotNumber: emptyToUndefined(line.lotNumber),
        expiryDate: emptyToUndefined(line.expiryDate),
        locationCode: line.locationCode,
        note: emptyToUndefined(line.note),
        ...cartonFields(line),
      })),
    },
    idempotencyRequestConfig(idempotencyKey),
  );
  return toReceipt(beGoodsReceiptSchema.parse(data));
}

/**
 * Thay toàn bộ kiểm đếm của phiếu DRAFT (BE `ReceiptLinesRequest`). `Idempotency-Key`: gửi lại một lần lưu có thùng
 * mới (mất mạng / bấm lại) không làm BE cấp bộ LPN thứ hai và VOID bộ đầu — có thể đã in nhãn (issue #104).
 */
export async function replaceReceiptLines({
  receiptId,
  lines,
  idempotencyKey,
}: SaveReceiptLinesInput): Promise<GoodsReceipt> {
  const { data } = await api.put<unknown>(
    `${receiptPath(receiptId)}/lines`,
    {
      lines: lines.map((line) => ({
        purchaseOrderLineId: line.purchaseOrderLineId,
        quantity: line.quantity,
        lotNumber: emptyToUndefined(line.lotNumber),
        expiryDate: emptyToUndefined(line.expiryDate),
        locationCode: line.locationCode,
        note: emptyToUndefined(line.note),
        ...cartonFields(line),
      })),
    },
    idempotencyRequestConfig(idempotencyKey),
  );
  return toReceipt(beGoodsReceiptSchema.parse(data));
}
