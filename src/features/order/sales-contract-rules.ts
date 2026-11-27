/**
 * Hợp đồng — vòng đời + kiểm tra thuần (docs 14 §4.3, §5; BE `SalesContractStatus`, origin/develop 438fe6fb):
 *   (chưa có / CANCELLED) + đơn DRAFT → lập; DRAFT → sửa, gửi, huỷ; SENT → ghi nhận đã ký, huỷ;
 *   SIGNED / COMPLETED / LIQUIDATED (thanh lý, WF-05 Q-6): chỉ xem, tải bản đã gửi / đã ký. Huỷ đưa đơn về DRAFT để
 *   lập lại. Trạng thái lạ (UNKNOWN): không thao tác.
 * UI-only — Backend phải re-check (quyền sales-contracts CREATE / UPDATE / APPROVE).
 */

import { SALES_CONTRACT_PERMISSIONS, SALES_CONTRACT_SIGNED_STATUSES } from "@/constants";
import { ORDER_CONTRACT_LABELS } from "@/constants/labels-order-contract";

import { DEFAULT_ON_SIGNING_DUE_DAYS } from "./sales-contract-form";

import type { PermissionCode } from "@/lib/auth/me-permissions";
import type { ContractFormValues } from "./sales-contract-form";
import type { ContractCreditReviewView, SalesContract } from "./sales-contract-schemas";
import type { Order } from "./types";

export type ContractAction =
  "create" | "edit" | "send" | "sign" | "cancel" | "preview" | "withdraw-review";

export const CONTRACT_TRANSITIONS = {
  DRAFT: ["SENT", "CANCELLED"],
  SENT: ["SIGNED", "CANCELLED"],
  // LIQUIDATED: đơn kết thúc mà không giao được gì, đã xong tiền (Q-6, BE-06)
  SIGNED: ["COMPLETED", "LIQUIDATED"],
  COMPLETED: [],
  LIQUIDATED: [],
  CANCELLED: [],
  UNKNOWN: [],
} as const satisfies Record<SalesContract["status"], readonly SalesContract["status"][]>;

/**
 * 15 BR-11 (BE PR #486): nháp đang chờ Kế toán duyệt tín dụng (`creditReview = PENDING`) — BE trả 409
 * CONTRACT_CREDIT_REVIEW_PENDING cho sửa / gửi lại / gợi ý lịch → bỏ "edit", "send"; Sale có "withdraw-review" để rút
 * về sửa. Huỷ hợp đồng và xem PDF nháp không bị BE chặn nên giữ.
 */
export function allowedContractActions(
  contract: (Pick<SalesContract, "status"> & Partial<Pick<SalesContract, "creditReview">>) | null,
  orderStatus: Order["status"],
  can: (code: PermissionCode) => boolean,
): ContractAction[] {
  const status = contract?.status ?? null;
  const actions: ContractAction[] = [];
  if (
    (status === null || status === "CANCELLED") &&
    orderStatus === "Draft" &&
    can(SALES_CONTRACT_PERMISSIONS.create)
  )
    actions.push("create");
  const reviewPending = status === "DRAFT" && contract?.creditReview === "PENDING";
  if (status === "DRAFT" && can(SALES_CONTRACT_PERMISSIONS.update))
    actions.push(
      ...(reviewPending ? (["withdraw-review"] as const) : (["edit", "send"] as const)),
      "cancel",
    );
  if (status === "DRAFT") actions.push("preview");
  if (status === "SENT" && can(SALES_CONTRACT_PERMISSIONS.approve)) actions.push("sign");
  if (status === "SENT" && can(SALES_CONTRACT_PERMISSIONS.update)) actions.push("cancel");
  return actions;
}

/** Đơn không còn giao / thu gì thêm — BE `ContractPaperService.ended` (COMPLETED, CANCELLED, CLOSED, REFUNDED, PARTIALLY_REFUNDED). */
const CONTRACT_ENDED_ORDER_STATUSES: readonly Order["status"][] = [
  "Completed",
  "Cancelled",
  "Closed",
  "Refunded",
  "Partially Refunded",
];

/**
 * Giấy tờ sau ký (BE `feat/business-documents`, endpoints #1, #2): phụ lục chỉ khi BE báo `appendixAvailable` (đã ký và
 * có đợt giao đang hiệu lực khác cửa sổ đã ký — đúng điều kiện GET …/appendix trả 200); biên bản thanh lý khi đã ký VÀ
 * hợp đồng đã kết thúc (Hoàn tất / Thanh lý) hoặc đơn đã kết thúc. BE còn từ chối khi số "Còn lại" khác 0 (owner
 * 2026-11-23, `details.reason` NOT_SETTLED) — FE không tính lại, hiện câu lỗi có số tiền. Quyền `sales-contracts:READ` do
 * nút kiểm. UI-only — Backend re-check.
 */
export function contractPapers(
  contract: Pick<SalesContract, "status" | "appendixAvailable">,
  orderStatus: Order["status"],
): { appendix: boolean; liquidation: boolean } {
  const signed = (SALES_CONTRACT_SIGNED_STATUSES as readonly string[]).includes(contract.status);
  const ended =
    contract.status === "COMPLETED" ||
    contract.status === "LIQUIDATED" ||
    CONTRACT_ENDED_ORDER_STATUSES.includes(orderStatus);
  return { appendix: signed && contract.appendixAvailable, liquidation: signed && ended };
}

export interface CartonGap {
  orderLineId: string;
  sku: string;
  ordered: number;
  scheduled: number;
  /** scheduled − ordered: âm = còn thiếu, dương = dư. */
  diff: number;
}

/** F-04.2: với mỗi dòng đơn, Σ thùng các đợt giao phải bằng số thùng của dòng. */
export function cartonGaps(
  lines: readonly Pick<Order["lines"][number], "lineId" | "sku" | "cartons">[],
  schedule: ContractFormValues["deliverySchedule"],
): CartonGap[] {
  return lines.map((line) => {
    const scheduled = schedule.reduce(
      (sum, batch) =>
        sum +
        (Number(batch.lines.find((entry) => entry.orderLineId === line.lineId)?.cartons) || 0),
      0,
    );
    const ordered = line.cartons ?? 0;
    return {
      orderLineId: line.lineId,
      sku: line.sku,
      ordered,
      scheduled,
      diff: scheduled - ordered,
    };
  });
}

/**
 * Quy tắc ra hạn của một đợt thanh toán, viết thành câu (BO-UX-26 / BO-UX-28): số ngày là số ngày SAU MỐC, không phải
 * một ngày trong tháng. ON_SIGNING trống số ngày → 3 ngày (BE-13); AFTER_DELIVERY trống → theo hạn tín dụng của khách;
 * BEFORE_DELIVERY không có số ngày (phải trả trước khi hàng rời kho, 15 BR-08).
 */
export function dueRuleText(entry: {
  milestone: string;
  dueDays?: string | number | null;
  deliveryBatchSeq?: string | number | null;
}): string {
  const days = entry.dueDays === "" || entry.dueDays == null ? null : Number(entry.dueDays);
  const batch =
    entry.deliveryBatchSeq === "" || entry.deliveryBatchSeq == null
      ? null
      : Number(entry.deliveryBatchSeq);
  const delivery = batch ? `ngày giao đợt ${batch}` : "ngày giao";
  switch (entry.milestone) {
    case "ON_SIGNING":
      return `Hạn = ngày ký + ${days ?? DEFAULT_ON_SIGNING_DUE_DAYS} ngày`;
    case "BEFORE_DELIVERY":
      return batch ? `Hạn = trước khi xuất hàng đợt ${batch}` : "Hạn = trước khi xuất hàng";
    case "AFTER_DELIVERY":
      return days != null
        ? `Hạn = ${delivery} + ${days} ngày`
        : `Hạn = ${delivery} + hạn tín dụng của khách`;
    default:
      return days != null ? `Hạn = mốc + ${days} ngày` : "";
  }
}

/** Một đợt thanh toán quy ra tiền (xem trước; % quy theo tổng có thuế, phần lẻ BE dồn đợt cuối). */
export function planEntryAmount(
  entry: Pick<ContractFormValues["paymentPlan"][number], "mode" | "value">,
  totalWithTax: number,
): number {
  const value = Number(entry.value) || 0;
  return entry.mode === "percent" ? Math.round((totalWithTax * value) / 100) : value;
}

/** Tổng các đợt thanh toán quy ra tiền (xem trước; % quy theo tổng có thuế, phần lẻ BE dồn đợt cuối). */
export function planTotal(plan: ContractFormValues["paymentPlan"], totalWithTax: number): number {
  return plan.reduce((sum, entry) => sum + planEntryAmount(entry, totalWithTax), 0);
}

/**
 * Phần hợp đồng này trả sau giao — đúng số BE dùng để kiểm hạn mức khi gửi (`SalesContractService.creditCheck`: tổng
 * các đợt mốc AFTER_DELIVERY; 15 BR-10, BR-11). 0 = lịch không xin công nợ, BE không kiểm.
 */
export function planDeferredAmount(
  plan: ContractFormValues["paymentPlan"],
  totalWithTax: number,
): number {
  return planTotal(
    plan.filter((entry) => entry.milestone === "AFTER_DELIVERY"),
    totalWithTax,
  );
}

/** Thông báo cảnh báo tín dụng (15 BR-11) theo `outcome` của BE. */
export function creditWarningText(
  warning: NonNullable<SalesContract["creditWarning"]>,
  format: (amount: number) => string,
): string {
  // 15 BR-11 (BE PR #486): gửi lúc này không tới khách ngay mà phải chờ Kế toán duyệt tín dụng trước.
  if (warning.outcome === "OVERDUE")
    return "Khách đang có khoản quá hạn. Bấm gửi thì hợp đồng phải chờ Kế toán duyệt tín dụng rồi mới tới khách.";
  return `Phần trả sau giao (${format(warning.afterDelivery ?? 0)}) cộng dư nợ hiện tại (${format(warning.exposure ?? 0)}) vượt hạn mức (${format(warning.creditLimit ?? 0)}). Bấm gửi thì hợp đồng phải chờ Kế toán duyệt tín dụng rồi mới tới khách.`;
}

/** Vì sao hợp đồng phải chờ Kế toán (BE `checkOutcome`, số liệu tại lúc gửi duyệt). */
export function creditReviewReasonText(
  review: Pick<
    ContractCreditReviewView,
    "checkOutcome" | "creditLimit" | "exposure" | "afterDelivery" | "overdueAmount"
  >,
  format: (amount: number) => string,
): string {
  if (review.checkOutcome === "OVERDUE")
    return `Khách đang có khoản quá hạn (${format(review.overdueAmount ?? 0)}).`;
  return `Phần trả sau giao (${format(review.afterDelivery ?? 0)}) cộng dư nợ (${format(review.exposure ?? 0)}) vượt hạn mức (${format(review.creditLimit ?? 0)}).`;
}

const FIELD_NAMES: Readonly<Record<string, string>> = {
  windowStart: "Từ ngày",
  windowEnd: "Đến ngày",
  cartons: "Số thùng",
  amount: "Số tiền",
  percent: "Tỷ lệ %",
  name: "Tên đợt",
  milestone: "Mốc",
  dueDays: "Số ngày",
  deliveryBatchSeq: "Đợt giao gắn kèm",
};

/**
 * Tên dễ đọc của một `fieldErrors[].field` hợp đồng của BE (plan §1.2): `deliverySchedule[1].windowStart` → "Đợt giao 2
 * · Từ ngày", `paymentPlan[0].amount` → "Đợt thanh toán 1 · Số tiền", `deliverySchedule` → "Lịch giao". Trường lạ giữ
 * nguyên tên BE.
 */
export function contractFieldLabel(field: string): string {
  if (field === "deliverySchedule") return "Lịch giao";
  if (field === "paymentPlan") return "Lịch thanh toán";
  const batchLine = /^deliverySchedule\[(\d+)\]\.lines\[(\d+)\]\.(\w+)$/.exec(field);
  if (batchLine)
    return `Đợt giao ${Number(batchLine[1]) + 1} · dòng ${Number(batchLine[2]) + 1} · ${FIELD_NAMES[batchLine[3]!] ?? batchLine[3]}`;
  const entry = /^(deliverySchedule|paymentPlan)\[(\d+)\](?:\.(\w+))?$/.exec(field);
  if (entry) {
    const head = `${entry[1] === "deliverySchedule" ? "Đợt giao" : "Đợt thanh toán"} ${Number(entry[2]) + 1}`;
    return entry[3] ? `${head} · ${FIELD_NAMES[entry[3]] ?? entry[3]}` : head;
  }
  return field;
}

/** Kết quả sau khi ký (F-04.3) theo trạng thái đơn đọc lại. */
export function signOutcomeText(order: Pick<Order, "status" | "holdReason">): string | null {
  if (order.status === "Pending Payment")
    return "Đã ký. Đơn chờ thanh toán đợt khi ký (chưa giữ hàng).";
  if (order.status === "Confirmed") return "Đã ký. Đơn đã xác nhận.";
  if (order.status === "On Hold" && order.holdReason === "CREDIT")
    return "Đã ký. Đơn đang chờ Kế toán duyệt tín dụng.";
  return null;
}

/**
 * Mục 10: các đợt giao có cửa sổ kết thúc trước HÔM NAY (không phải ngày ký — ngày ký luôn ≤ hôm nay).
 * `today` là "YYYY-MM-DD" theo Asia/Ho_Chi_Minh. Chỉ để cảnh báo, không chặn ghi nhận đã ký.
 */
export function passedBatches(
  contract: Pick<SalesContract, "deliverySchedule">,
  today: string,
): { seq: number; windowEnd: string }[] {
  return contract.deliverySchedule.flatMap((batch) =>
    batch.windowEnd && batch.windowEnd < today
      ? [{ seq: batch.seq, windowEnd: batch.windowEnd }]
      : [],
  );
}

export function passedBatchesText(passed: readonly { seq: number }[]): string | null {
  if (passed.length === 0) return null;
  return `Đợt giao ${passed.map((batch) => batch.seq).join(", ")} đã qua — sau khi ký dùng 'Dời cửa sổ giao' ở khối Lịch giao để đặt lại.`;
}

/**
 * Gửi hợp đồng cần mọi đợt giao có cửa sổ giao và không đợt nào bắt đầu trước hôm nay (docs 14 §4.3 bước 11, BR-23; BE
 * `ContractTerms.requireWindows`). Tính trước để nút "Gửi hợp đồng" khoá kèm lý do, thay vì để Sale bấm rồi mới nghe lỗi.
 * `today` là "YYYY-MM-DD" theo Asia/Ho_Chi_Minh. UI-only — BE vẫn kiểm lại.
 */
export function sendBlockers(
  contract: Pick<SalesContract, "deliverySchedule">,
  today: string,
): { missing: number[]; past: number[] } {
  const missing: number[] = [];
  const past: number[] = [];
  contract.deliverySchedule.forEach((batch, index) => {
    const seq = batch.seq ?? index + 1;
    if (!batch.windowStart) missing.push(seq);
    else if (batch.windowStart < today) past.push(seq);
  });
  return { missing, past };
}

/** Một dòng "Còn thiếu: …" dưới nút Gửi hợp đồng (R7); `null` khi gửi được. */
export function sendBlockersText(blockers: { missing: number[]; past: number[] }): string | null {
  const parts: string[] = [];
  if (blockers.missing.length > 0)
    parts.push(ORDER_CONTRACT_LABELS.sendBlocked.missing(blockers.missing));
  if (blockers.past.length > 0) parts.push(ORDER_CONTRACT_LABELS.sendBlocked.past(blockers.past));
  return parts.length > 0 ? parts.join(" ") : null;
}

/** Mục 29: BE `FileCategory.DOCUMENT` — pdf, docx, xlsx, jpeg, png (else 415). `.webp` is not accepted. */
const SIGNED_FILE_TYPES: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "image/jpeg": ".jpg,.jpeg",
  "image/png": ".png",
};
export const SIGNED_FILE_ACCEPT = Object.keys(SIGNED_FILE_TYPES).join(",");
export const SIGNED_FILE_TYPE_MESSAGE = "Chỉ nhận PDF, Word, Excel hoặc ảnh JPG/PNG.";

/**
 * MIME type first; some browsers leave it empty (or say `application/octet-stream`) for Office files, so fall
 * back to the extension in both cases.
 */
export function isSignedFileTypeAllowed(file: Pick<File, "name" | "type">): boolean {
  if (file.type && file.type !== "application/octet-stream") return file.type in SIGNED_FILE_TYPES;
  const name = file.name.toLowerCase();
  return Object.values(SIGNED_FILE_TYPES)
    .flatMap((extensions) => extensions.split(","))
    .some((extension) => name.endsWith(extension));
}
