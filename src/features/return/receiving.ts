/**
 * Selector thuần cho phiếu nhập hàng hoàn của yêu cầu trả hàng (WF-05 BE-22, Q-11): nhận theo **số lượng của từng SKU đã
 * duyệt**, không theo số thùng — khách gửi lại thùng nào trong số thùng của chuyến là việc của khách. Số liệu lấy nguyên
 * từ BE (`returnProgress`, `candidateCartons`); FE không tự tính lại trần.
 */

import { RETURN_CARTON_CANDIDATES } from "@/constants/returns";

import type { CandidateCarton, ReturnProgress, ReturnReceipt } from "./types";

export interface RmaReceiving {
  rows: readonly ReturnProgress[];
  approved: number;
  /** Trên các phiếu khác đã xác nhận — đã nhận chính thức. */
  confirmed: number;
  /** Trên phiếu này: nháp = mới ghi, chưa chính thức; CLOSED = đã xác nhận trên phiếu này. */
  current: number;
  remaining: number;
  /** Mọi SKU đã duyệt không còn gì để nhận. */
  complete: boolean;
  /** Phiếu NHÁP đã ghi đủ số còn lại — đếm xong nhưng còn phải xác nhận phiếu. */
  countedAwaitingConfirmation: boolean;
}

const sum = (rows: readonly ReturnProgress[], pick: (row: ReturnProgress) => number) =>
  rows.reduce((total, row) => total + pick(row), 0);

/** Null với phiếu chuyến hoàn (RTO) hoặc BE cũ chưa gửi `returnProgress` — màn quay về đối chiếu theo thùng. */
export function rmaReceiving(
  receipt: Pick<ReturnReceipt, "returnRequestId" | "returnProgress" | "status">,
): RmaReceiving | null {
  if (!receipt.returnRequestId || !receipt.returnProgress) return null;
  const rows = receipt.returnProgress;
  const remaining = sum(rows, (row) => row.remainingQuantity);
  const current = sum(rows, (row) => row.currentReceiptQuantity);
  const complete = rows.length > 0 && remaining === 0;
  return {
    rows,
    approved: sum(rows, (row) => row.approvedQuantity),
    confirmed: sum(rows, (row) => row.confirmedReceivedQuantity),
    current,
    remaining,
    complete,
    countedAwaitingConfirmation: receipt.status === "DRAFT" && complete && current > 0,
  };
}

/** Phần đã nhận (chính thức + trên phiếu) của một dòng, 0..100 — cho thanh tiến độ. */
export function progressPercent(row: ReturnProgress): number {
  if (row.approvedQuantity <= 0) return 0;
  const done = row.confirmedReceivedQuantity + row.currentReceiptQuantity;
  return Math.min(100, Math.round((done / row.approvedQuantity) * 100));
}

export const isWorkable = (carton: Pick<CandidateCarton, "eligibility">): boolean =>
  RETURN_CARTON_CANDIDATES.includes(carton.eligibility) && carton.eligibility !== "ON_THIS_RECEIPT";

/**
 * Thùng của nguồn chia hai: `workable` — nhận được ngay (nguyên thùng, hoặc phải mở đếm), đặt ở vùng làm việc; `excluded`
 * — không nhận được, kèm lý do, để tra cứu. Thùng đã trên phiếu nằm ở bảng "Đã ghi nhận", không lặp lại ở đây.
 */
export function splitCandidates(cartons: readonly CandidateCarton[] | null | undefined): {
  workable: CandidateCarton[];
  excluded: CandidateCarton[];
} {
  const all = cartons ?? [];
  return {
    workable: all.filter(isWorkable),
    excluded: all.filter((carton) => !RETURN_CARTON_CANDIDATES.includes(carton.eligibility)),
  };
}

/** Thùng ứng viên theo LPN (so khớp không phân biệt hoa thường như BE `normalLpn`). */
export function candidateByLpn(
  cartons: readonly CandidateCarton[] | null | undefined,
  lpn: string,
): CandidateCarton | undefined {
  const key = lpn.trim().toUpperCase();
  return (cartons ?? []).find((carton) => carton.lpn.toUpperCase() === key);
}

/** Còn nhận được của một SKU đã duyệt; null khi SKU không được duyệt hoặc chưa có số của BE. */
export function remainingOf(
  receipt: Pick<ReturnReceipt, "returnProgress">,
  sku: string,
): number | null {
  const row = receipt.returnProgress?.find((r) => r.sku === sku);
  return row ? row.remainingQuantity : null;
}
