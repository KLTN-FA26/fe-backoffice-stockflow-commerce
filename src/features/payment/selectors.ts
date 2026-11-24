/** Selector thuần cho thanh toán theo hợp đồng (docs 15). */

import {
  FEE_INSTALLMENT_MILESTONES,
  INSTALLMENT_STATUS_BY_API,
  RECEIPT_STATUS_BY_API,
} from "@/constants/payment";
import {
  CANCELLATION_FEE_ITEM_NAME,
  FEE_ITEM_MILESTONE_LABELS,
  FEE_ITEM_NAME_LABELS,
  INSTALLMENT_MILESTONE_LABELS,
  PAYMENT_LABELS,
  PAYMENT_LIST_LABELS,
} from "@/constants/labels-payment";
import { daysBetween, todayIso } from "@/lib/date-range";
import { statusLabelVi } from "@/lib/status-map";

import { installmentTakesMoney } from "./lifecycle";

import type {
  InstallmentDisplayStatus,
  InstallmentReadStatus,
  ReceiptReadStatus,
} from "@/constants/payment";
import type { Installment, ReceiptFormValues } from "./types";

const L = PAYMENT_LABELS.installments;

/** Nhãn tiếng Việt; trạng thái chưa có nhãn → "Không rõ", không lộ mã tiếng Anh ("Partially Paid") — BO-UX-6. */
export function installmentStatusLabel(status: InstallmentReadStatus): string {
  return (
    statusLabelVi(INSTALLMENT_STATUS_BY_API[status], "payment") ?? PAYMENT_LIST_LABELS.unknownStatus
  );
}

/**
 * Trạng thái hiển thị của đợt: đợt còn nợ đã qua hạn trả hiện "Overdue" (cờ `overdue` của BE —
 * quá hạn không còn là trạng thái, WF-05 fix plan §8; docs 15 §4.1 bước 4).
 */
export function displayStatus(
  installment: Pick<Installment, "status" | "overdue">,
): InstallmentDisplayStatus {
  return installment.overdue ? "OVERDUE" : installment.status;
}

export function receiptStatusLabel(status: ReceiptReadStatus): string {
  return (
    statusLabelVi(RECEIPT_STATUS_BY_API[status], "payment") ?? PAYMENT_LIST_LABELS.unknownStatus
  );
}

/**
 * Số ngày quá hạn của đợt: R5-12 `daysOverdue` khi BE gửi, không thì tính từ hạn trả tới hôm nay (giờ Việt Nam). Đợt
 * không có cờ `overdue` → 0.
 */
export function daysOverdue(
  installment: Pick<Installment, "overdue" | "dueDate"> & { daysOverdue?: number | null },
  today: string = todayIso(),
): number {
  if (!installment.overdue) return 0;
  if (installment.daysOverdue != null) return installment.daysOverdue;
  const due = installment.dueDate;
  return due ? Math.max(0, daysBetween(due.slice(0, 10), today)) : 0;
}

export function milestoneLabel(milestone: Installment["milestone"]): string {
  return INSTALLMENT_MILESTONE_LABELS[milestone];
}

/** Tên đợt / khoản phí như người dùng đọc: tên khoản phí BE (tiếng Anh) dịch sang tiếng Việt, tên đợt khác giữ nguyên. */
export function installmentName(name: string): string {
  return FEE_ITEM_NAME_LABELS[name.trim()] ?? name;
}

/**
 * Mốc của một đợt cụ thể: khoản phí (`CANCELLATION_FEE`) lập khi huỷ đơn hay khi đóng phần còn lại — kể cả phần phí của
 * các đợt giao đã đóng chuyển sang (audit r3 LM-3) — đọc theo tên BE đặt; tên lạ → nhãn chung của mốc.
 */
export function installmentMilestoneLabel(installment: {
  milestone: Installment["milestone"];
  name?: string | null;
}): string {
  const name = installment.name?.trim();
  if (installment.milestone === "CANCELLATION_FEE" && name && FEE_ITEM_NAME_LABELS[name]) {
    return name === CANCELLATION_FEE_ITEM_NAME
      ? FEE_ITEM_MILESTONE_LABELS.cancellation
      : FEE_ITEM_MILESTONE_LABELS.remainderClosure;
  }
  return milestoneLabel(installment.milestone);
}

/** "Đợt giao 2" khi đợt gắn đợt giao (docs 15 §4.1, BR-08); không gắn → "Không gắn đợt giao". */
export function deliveryBatchLabel(installment: Pick<Installment, "deliveryBatchSeq">): string {
  return installment.deliveryBatchSeq == null
    ? L.notTied
    : L.batchTied(installment.deliveryBatchSeq);
}

/**
 * Đợt đang chặn bàn giao: `BEFORE_DELIVERY` chưa `Paid` / `Cancelled` (docs 15 BR-08). Đợt gắn đợt
 * giao k chỉ chặn bàn giao của đợt k; đợt không gắn chặn từ lần bàn giao đầu — nhãn kèm `deliveryBatchLabel`.
 */
export function blocksHandover(installment: Pick<Installment, "milestone" | "status">): boolean {
  return installment.milestone === "BEFORE_DELIVERY" && installmentTakesMoney(installment.status);
}

/** Đợt có thể thêm vào phiếu thu (còn nhận tiền và còn số phải thu > 0). */
export function payableInstallments(installments: readonly Installment[]): Installment[] {
  return installments.filter((i) => installmentTakesMoney(i.status) && i.outstanding > 0);
}

/** Tổng các dòng của form phiếu thu — dòng chưa nhập số hợp lệ tính 0. */
export function receiptFormTotal(lines: ReceiptFormValues["lines"]): number {
  return lines.reduce((sum, line) => {
    const amount = /^\d+$/.test(line.amount.trim()) ? Number(line.amount.trim()) : 0;
    return sum + amount;
  }, 0);
}

/** Khoản phí (huỷ đơn / đóng phần còn lại / chuyến hỏng cũ), không phải đợt của lịch — FE-7. */
export function isFeeInstallment(installment: { milestone?: Installment["milestone"] | null }) {
  return FEE_INSTALLMENT_MILESTONES.some((fee) => fee === installment.milestone);
}

type TitleSource = {
  seq: number;
  name?: string | null;
  milestone?: Installment["milestone"] | null;
};

/**
 * Tên đợt hiển thị: "Đợt 2 — Thanh toán trước khi giao". Khoản phí (seq 21–40) không gọi "Đợt 21": chỉ tên khoản phí
 * ("Phí huỷ đơn"), không có tên thì nhãn mốc (FE-7).
 */
export function installmentTitle(installment: TitleSource): string {
  const name = installment.name ? installmentName(installment.name) : null;
  if (installment.milestone && isFeeInstallment(installment))
    return name ?? milestoneLabel(installment.milestone);
  return name ? `Đợt ${installment.seq} — ${name}` : `Đợt ${installment.seq}`;
}

/** Đợt trong câu (nhãn nút cho trình đọc màn hình): "đợt 4", khoản phí → tên khoản phí. */
export function installmentRef(installment: TitleSource): string {
  return installment.milestone && isFeeInstallment(installment)
    ? installmentTitle(installment)
    : `đợt ${installment.seq}`;
}
