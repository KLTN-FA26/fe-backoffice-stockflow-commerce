/** Thanh toán theo hợp đồng — API layer (BE payment module). Parse tại biên. */

import { api } from "@/lib/api/client";

import {
  installmentDtoSchema,
  installmentPageDtoSchema,
  orderInstallmentsDtoSchema,
  orderRefundDtoSchema,
  orderRefundPageDtoSchema,
  receiptDtoSchema,
  receiptPageDtoSchema,
} from "./schemas";

import type {
  InstallmentApiStatus,
  InstallmentMilestone,
  ReceiptApiStatus,
} from "@/constants/payment";
import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";
import type {
  Installment,
  OrderInstallments,
  OrderRefund,
  PaymentReceipt,
  ReceiptInput,
  RefundRecordInput,
  VoidInput,
} from "./types";

const INSTALLMENTS = "/installments";
const RECEIPTS = "/payment-receipts";
const REFUNDS = "/refunds";
const seg = encodeURIComponent;

function pageQuery(params: ListQueryParams) {
  const query = new URLSearchParams({
    page: String(Math.max(0, params.page ?? 0)),
    size: String(params.size ?? 15),
  });
  if (params.sort) query.set("sort", params.sort);
  return query;
}

/* ── Đợt thanh toán ─────────────────────────────────────────────────── */

export interface ListInstallmentParams extends ListQueryParams {
  customerId?: string;
  orderId?: string;
  /** BE nhận MỘT trạng thái (enum), không phải danh sách; không bao giờ `OVERDUE` (400). */
  status?: Exclude<InstallmentApiStatus, "OVERDUE">;
  milestone?: InstallmentMilestone;
  /** `YYYY-MM-DD`: chỉ đợt có hạn trả trước ngày này. */
  dueBefore?: string;
  /** true = mốc đã đến (đang đến hạn), false = còn chờ mốc. */
  reached?: boolean;
  /** true = chỉ đợt quá hạn (BE tính từ hạn trả; quá hạn không còn là trạng thái). */
  overdue?: boolean;
  /** `dueDate|seq|amount|status|createdAt[,asc|desc]` — mặc định `dueDate` tăng dần. */
  sort?: string;
}

export async function listInstallments(
  params: ListInstallmentParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<Installment>> {
  const query = pageQuery(params);
  if (params.customerId) query.set("customerId", params.customerId);
  if (params.orderId) query.set("orderId", params.orderId);
  if (params.status) query.set("status", params.status);
  if (params.milestone) query.set("milestone", params.milestone);
  if (params.dueBefore) query.set("dueBefore", params.dueBefore);
  if (params.reached !== undefined) query.set("reached", String(params.reached));
  if (params.overdue !== undefined) query.set("overdue", String(params.overdue));
  const { data } = await api.get<unknown>(INSTALLMENTS, { params: query, signal });
  return installmentPageDtoSchema.parse(data);
}

export async function getInstallment(id: string, signal?: AbortSignal): Promise<Installment> {
  const { data } = await api.get<unknown>(`${INSTALLMENTS}/${seg(id)}`, { signal });
  return installmentDtoSchema.parse(data);
}

export async function getOrderInstallments(
  orderId: string,
  signal?: AbortSignal,
): Promise<OrderInstallments> {
  const { data } = await api.get<unknown>(`${INSTALLMENTS}/orders/${seg(orderId)}`, { signal });
  return orderInstallmentsDtoSchema.parse(data);
}

/* ── Phiếu thu ──────────────────────────────────────────────────────── */

export interface ListReceiptParams extends ListQueryParams {
  customerId?: string;
  status?: ReceiptApiStatus;
  /** Mã tham chiếu sao kê — BE khớp chính xác. */
  reference?: string;
  /** `receivedOn|recordedAt|amount[,asc|desc]` — mặc định `recordedAt` giảm dần. */
  sort?: string;
}

export async function listReceipts(
  params: ListReceiptParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<PaymentReceipt>> {
  const query = pageQuery(params);
  if (params.customerId) query.set("customerId", params.customerId);
  if (params.status) query.set("status", params.status);
  if (params.reference?.trim()) query.set("reference", params.reference.trim());
  const { data } = await api.get<unknown>(RECEIPTS, { params: query, signal });
  return receiptPageDtoSchema.parse(data);
}

export async function getReceipt(id: string, signal?: AbortSignal): Promise<PaymentReceipt> {
  const { data } = await api.get<unknown>(`${RECEIPTS}/${seg(id)}`, { signal });
  return receiptDtoSchema.parse(data);
}

/** Lập phiếu thu: số tiền gửi dạng số (BE `BigDecimal`, nguyên đồng). */
export async function recordReceipt(input: ReceiptInput): Promise<PaymentReceipt> {
  const { data } = await api.post<unknown>(RECEIPTS, {
    customerId: input.customerId,
    reference: input.reference,
    receivedOn: input.receivedOn,
    ...(input.note ? { note: input.note } : {}),
    lines: input.lines.map((line) => ({
      installmentId: line.installmentId,
      amount: Number(line.amount),
    })),
  });
  return receiptDtoSchema.parse(data);
}

export async function voidReceipt(input: { id: string } & VoidInput): Promise<PaymentReceipt> {
  const { data } = await api.post<unknown>(`${RECEIPTS}/${seg(input.id)}/void`, {
    reason: input.reason,
    holdOrders: input.holdOrders,
  });
  return receiptDtoSchema.parse(data);
}

/* ── Hoàn tiền ──────────────────────────────────────────────────────── */

export interface ListRefundParams extends ListQueryParams {
  customerId?: string;
  /** true = chỉ đơn chưa hoàn đủ. */
  outstanding?: boolean;
}

export async function listRefunds(
  params: ListRefundParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<OrderRefund>> {
  const query = pageQuery(params);
  if (params.customerId) query.set("customerId", params.customerId);
  if (params.outstanding !== undefined) query.set("outstanding", String(params.outstanding));
  const { data } = await api.get<unknown>(REFUNDS, { params: query, signal });
  return orderRefundPageDtoSchema.parse(data);
}

export async function getOrderRefund(orderId: string, signal?: AbortSignal): Promise<OrderRefund> {
  const { data } = await api.get<unknown>(`${REFUNDS}/orders/${seg(orderId)}`, { signal });
  return orderRefundDtoSchema.parse(data);
}

export async function recordRefund(
  input: { orderId: string } & RefundRecordInput,
): Promise<OrderRefund> {
  const { data } = await api.post<unknown>(`${REFUNDS}/orders/${seg(input.orderId)}/records`, {
    amount: Number(input.amount),
    refundedOn: input.refundedOn,
    reference: input.reference,
    ...(input.note ? { note: input.note } : {}),
  });
  return orderRefundDtoSchema.parse(data);
}

export async function voidRefundRecord(input: {
  recordId: string;
  reason: string;
}): Promise<OrderRefund> {
  const { data } = await api.post<unknown>(`${REFUNDS}/records/${seg(input.recordId)}/void`, {
    reason: input.reason,
  });
  return orderRefundDtoSchema.parse(data);
}
