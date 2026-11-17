/**
 * Selector thuần của trả hàng — trần số lượng theo BE `ReturnLine` (`claimedUnits`, `refundableUnits`) và tiến độ quét
 * của phiếu nhập hàng hoàn. Không side effect.
 */

import type { ReturnApiStatus } from "@/constants/returns";
import type { ExpectedCarton, ReturnLine, ReturnReceipt, ReturnRequest } from "./types";

/** Số một dòng của yêu cầu đang "giữ" trên dòng đơn (BE `ReturnLine.claimedUnits`). */
export function claimedUnits(line: ReturnLine, status: ReturnApiStatus): number {
  switch (status) {
    case "REQUESTED":
      return line.requestedQuantity;
    case "AWAITING_RETURN":
    case "RECEIVED":
    case "SETTLEMENT_PENDING":
      return line.approvedQuantity ?? 0;
    case "RESOLVED":
      return line.refundQuantity;
    default:
      return 0;
  }
}

/**
 * Còn trả được bao nhiêu trên mỗi dòng đơn: đã giao − phần các yêu cầu khác đang giữ (BE `ReturnRequest.open`,
 * `RETURN_QUANTITY_EXCEEDED`). Dòng có yêu cầu đang mở bị khoá hẳn (`RETURN_LINE_ALREADY_OPEN`) → 0.
 */
export function openCaps(
  orderLines: readonly { lineId: string; deliveredQuantity: number }[],
  returns: readonly Pick<ReturnRequest, "status" | "lines">[],
  isOpen: (status: ReturnApiStatus) => boolean,
): Map<string, number> {
  const claimed = new Map<string, number>();
  const locked = new Set<string>();
  for (const ret of returns) {
    for (const line of ret.lines) {
      claimed.set(
        line.orderLineId,
        (claimed.get(line.orderLineId) ?? 0) + claimedUnits(line, ret.status),
      );
      if (isOpen(ret.status)) locked.add(line.orderLineId);
    }
  }
  return new Map(
    orderLines.map((line) => [
      line.lineId,
      locked.has(line.lineId)
        ? 0
        : Math.max(0, line.deliveredQuantity - (claimed.get(line.lineId) ?? 0)),
    ]),
  );
}

/** Trần hoàn của một dòng: đã duyệt và đã về kho (BE `ReturnLine.refundableUnits`). */
export const refundableUnits = (line: ReturnLine): number =>
  Math.min(line.approvedQuantity ?? 0, line.receivedQuantity ?? 0);

/** Giá trị dự kiến của đề xuất (đơn giá dòng × SL) — BE tính lại gồm VAT, đây chỉ là ước tính trước thuế. */
export function proposedValue(
  lines: readonly ReturnLine[],
  quantities: ReadonlyMap<string, number>,
): number {
  return lines.reduce((sum, line) => sum + line.unitPrice * (quantities.get(line.id) ?? 0), 0);
}

export interface ScanProgress {
  scanned: number;
  expected: number;
  /** Thùng của nguồn chưa quét. */
  missing: ExpectedCarton[];
  /** Thùng đã quét nhưng không có trong danh sách của nguồn (BE vẫn chặn `RETURN_CARTON_NOT_OF_SOURCE`). */
  extra: number;
}

/** So thùng đã quét với thùng của nguồn (docs 03 §4.2 bước 11) — quét thiếu vẫn xác nhận được. */
export function scanProgress(
  receipt: Pick<ReturnReceipt, "cartons" | "expectedCartons">,
): ScanProgress {
  const expectedLpns = new Set(receipt.expectedCartons.map((carton) => carton.lpn));
  return {
    scanned: receipt.cartons.length,
    expected: receipt.expectedCartons.length,
    missing: receipt.expectedCartons.filter((carton) => !carton.scanned),
    extra: receipt.cartons.filter((carton) => !expectedLpns.has(carton.lpn)).length,
  };
}
