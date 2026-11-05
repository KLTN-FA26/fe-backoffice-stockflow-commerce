/**
 * Goods receipt — QC dòng nhận (luồng 3 bước, docs 03 bước 7–9): chuyển sang khu QC, kết luận QC.
 * SCRUM-473: thùng chuyển nguyên thùng; kết luận nêu thùng cách ly / không đạt theo LPN.
 */

import { receiptPath, postReceipt } from "./api";

import type { InspectLineInput, MoveLineToQcInput, ReceiptLineDto } from "./types";

/** BE chuyển phần lẻ + MỌI thùng của dòng sang khu QC (thùng giữ LPN, không mở). */
export const moveLineToQc = ({ receiptId, lineId, qcLocationCode }: MoveLineToQcInput) =>
  postReceipt(`${receiptPath(receiptId)}/lines/${encodeURIComponent(lineId)}/qc-transfer`, {
    qcLocationCode,
  });

/**
 * BE `QcDecisionRequest` (SCRUM-473 §5): `quantity` của phần cách ly / không đạt là SỐ LẺ, `packages` là LPN các thùng
 * đi nguyên thùng; `accepted` = phần lẻ Đạt + các thùng Đạt (theo `receivedQty`) — thùng không nêu tên thuộc phần Đạt.
 * Phần không có hàng (0 lẻ, không thùng) gửi `null`.
 */
export function toQcDecisionRequest(
  decision: InspectLineInput["decision"],
  line: Pick<ReceiptLineDto, "packages">,
) {
  const cartonsOf = (outcome: string) =>
    line.packages.filter((carton) => (decision.cartons[carton.lpn] ?? "ACCEPTED") === outcome);
  const part = (
    { quantity, locationCode, reason }: InspectLineInput["decision"]["rejected"],
    outcome: string,
  ) => {
    const packages = cartonsOf(outcome).map((carton) => carton.lpn);
    return quantity > 0 || packages.length > 0
      ? { quantity, packages, locationCode: locationCode.toUpperCase(), reason }
      : null;
  };
  return {
    accepted:
      decision.accepted +
      cartonsOf("ACCEPTED").reduce((sum, carton) => sum + carton.receivedQty, 0),
    quarantined: part(decision.quarantined, "QUARANTINE"),
    rejected: part(decision.rejected, "REJECTED"),
  };
}

export const inspectLine = ({ receiptId, lineId, line, decision }: InspectLineInput) =>
  postReceipt(
    `${receiptPath(receiptId)}/lines/${encodeURIComponent(lineId)}/inspection`,
    toQcDecisionRequest(decision, line),
  );
