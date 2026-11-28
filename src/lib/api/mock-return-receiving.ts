/**
 * Mock — quy tắc nhận hàng của phiếu nhập hàng hoàn theo yêu cầu trả hàng, chép đúng BE (`ReturnReceiptService.scan`,
 * `recordLoose`, `view`; `ReturnCartonEligibility`; `procurement.return_units_received`): chỉ SKU được duyệt, tổng số trên
 * các phiếu không huỷ (thùng theo số đếm + hàng lẻ) không vượt số duyệt, thùng không chia; thùng đã về / từng về mở / hàng
 * giữ hộ khách không nhận lại. Để chế độ mock không nhận một thao tác mà BE thật từ chối.
 */

import { mockHeldForCustomer } from "./mock-customer-custody";
import { mockReturnReceipts, mockReturns } from "./mock-returns-store";

import type { MockReturn, MockReturnReceipt } from "./mock-returns-store";

type SourceCarton = MockReturnReceipt["source"][number];

export const returnOf = (receipt: MockReturnReceipt): MockReturn | undefined =>
  receipt.returnRequestId ? mockReturns().find((r) => r.id === receipt.returnRequestId) : undefined;

export const approvedOf = (ret: MockReturn | undefined, sku: string): number =>
  (ret?.lines ?? [])
    .filter((l) => l.sku === sku)
    .reduce((sum, l) => sum + (l.approvedQuantity ?? 0), 0);

/** Đơn vị của SKU trên một phiếu: thùng theo số đếm + hàng lẻ (bỏ dòng hàng lẻ `exceptLoose` đang ghi lại). */
export function unitsOn(receipt: MockReturnReceipt, sku: string, exceptLoose?: string): number {
  return (
    receipt.cartons.filter((c) => c.sku === sku).reduce((sum, c) => sum + c.countedQuantity, 0) +
    receipt.looseLines
      .filter((l) => l.sku === sku && l.id !== exceptLoose)
      .reduce((sum, l) => sum + l.quantity, 0)
  );
}

/** Các phiếu khác của cùng yêu cầu, không huỷ. */
const otherReceipts = (receipt: MockReturnReceipt) =>
  mockReturnReceipts().filter(
    (r) =>
      r.id !== receipt.id &&
      r.returnRequestId === receipt.returnRequestId &&
      r.status !== "CANCELLED",
  );

/** BE `return_units_received`: mọi phiếu không huỷ của yêu cầu, phiếu này gồm cả. */
export function unitsBack(receipt: MockReturnReceipt, sku: string, exceptLoose?: string): number {
  const own = receipt.status === "CANCELLED" ? 0 : unitsOn(receipt, sku, exceptLoose);
  return own + otherReceipts(receipt).reduce((sum, r) => sum + unitsOn(r, sku), 0);
}

/** BE `ReturnProgress`, một dòng mỗi SKU được duyệt. */
export function progressOf(receipt: MockReturnReceipt) {
  const ret = returnOf(receipt);
  if (!ret) return [];
  const skus = [...new Set(ret.lines.map((l) => l.sku))].filter((sku) => approvedOf(ret, sku) > 0);
  return skus.map((sku) => {
    const approved = approvedOf(ret, sku);
    const confirmed = otherReceipts(receipt)
      .filter((r) => r.status === "CLOSED")
      .reduce((sum, r) => sum + unitsOn(r, sku), 0);
    return {
      sku,
      approvedQuantity: approved,
      confirmedReceivedQuantity: confirmed,
      currentReceiptQuantity: receipt.status === "CANCELLED" ? 0 : unitsOn(receipt, sku),
      remainingQuantity: Math.max(0, approved - unitsBack(receipt, sku)),
    };
  });
}

/** BE `ReturnCartonEligibility.ofCarton`: trạng thái của thùng theo các phiếu đã xác nhận (đơn trước hoặc chuyến trước). */
export function cartonState(receipt: MockReturnReceipt, lpn: string): string | null {
  const back = mockReturnReceipts().find(
    (r) => r.id !== receipt.id && r.status === "CLOSED" && r.cartons.some((c) => c.lpn === lpn),
  );
  if (!back) return null;
  if (mockHeldForCustomer(back, lpn)) return "CUSTOMER_GOODS";
  return back.cartons.find((c) => c.lpn === lpn)?.opened ? "RETURNED_OPENED" : "IN_WAREHOUSE";
}

/** BE `CandidateCarton`: mọi thùng của nguồn, phân loại như lúc quét. */
export function candidatesOf(receipt: MockReturnReceipt) {
  const ret = returnOf(receipt);
  return receipt.source.map((carton: SourceCarton) => {
    const approved = approvedOf(ret, carton.sku);
    const remaining = approved - unitsBack(receipt, carton.sku);
    const onReceipt = receipt.cartons.find((c) => c.lpn === carton.lpn);
    const state = cartonState(receipt, carton.lpn);
    const eligibility = onReceipt
      ? "ON_THIS_RECEIPT"
      : (state ??
        (approved <= 0
          ? "SKU_NOT_APPROVED"
          : remaining <= 0
            ? "APPROVED_QUANTITY_REACHED"
            : carton.quantity <= remaining
              ? "RECEIVABLE"
              : "COUNT_REQUIRED"));
    const max = onReceipt
      ? Math.min(carton.quantity, onReceipt.countedQuantity + Math.max(0, remaining))
      : eligibility === "RECEIVABLE"
        ? carton.quantity
        : eligibility === "COUNT_REQUIRED"
          ? Math.max(0, remaining)
          : 0;
    return { ...carton, maxReceivableQuantity: max, eligibility };
  });
}
