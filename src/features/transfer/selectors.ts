/**
 * Transfer order — selector thuần (không side effect), derive từ dữ liệu BE trả về.
 */

import type { TransferLine, TransferOrder } from "./types";

type WithLines = Pick<TransferOrder, "lines">;

export function totalRequested(transfer: WithLines): number {
  return transfer.lines.reduce((sum, line) => sum + line.requested, 0);
}

export function totalShipped(transfer: WithLines): number {
  return transfer.lines.reduce((sum, line) => sum + line.shipped, 0);
}

/** SL chưa đi theo lệnh (xuất thiếu) — BE cho xuất 0..SL yêu cầu mỗi dòng. */
export function shortQuantity(line: TransferLine): number {
  return Math.max(0, line.requested - line.shipped);
}

/** Đã xuất mà có dòng xuất thiếu so với SL yêu cầu (BE DispatchTransferRequest: 0..SL yêu cầu mỗi dòng). */
export function isPartialDispatch(
  transfer: Pick<TransferOrder, "lines" | "dispatchedAt">,
): boolean {
  return !!transfer.dispatchedAt && transfer.lines.some((line) => shortQuantity(line) > 0);
}

/** Giá trị mặc định form xuất kho: xuất đủ SL yêu cầu từng dòng. */
export function defaultDispatchLines(transfer: WithLines) {
  return transfer.lines.map((line) => ({ lineId: line.lineId, shippedQuantity: line.requested }));
}

/** Lệnh BE → giá trị form sửa nháp. */
export function toTransferFormValues(transfer: TransferOrder) {
  return {
    fromWarehouseId: transfer.fromWarehouseId,
    toWarehouseId: transfer.toWarehouseId,
    reason: transfer.reason ?? "",
    expectedDate: transfer.expectedDate ?? "",
    lines: transfer.lines.map((line) => ({
      sku: line.sku,
      lotNumber: line.lotNumber ?? "",
      quantity: line.requested,
    })),
  } as const;
}
