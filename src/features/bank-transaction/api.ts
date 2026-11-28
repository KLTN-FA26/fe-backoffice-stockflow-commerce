/** Giao dịch ngân hàng SePay — API (BE `BankTransactionController`, `/bank-transactions`, PR #490). Parse tại biên. */

import { PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";

import {
  bankTransactionDtoSchema,
  bankTransactionPageDtoSchema,
  payableInstallmentPageSchema,
} from "./schemas";

import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";
import type { AssignBody, BankTransaction, PayableInstallment } from "./types";

const BASE = "/bank-transactions";
const path = (id: string, suffix = "") => `${BASE}/${encodeURIComponent(id)}${suffix}`;
/** Trần `size` của BE (`Pages.MAX_PAGE_SIZE`). */
const MAX_PAGE_SIZE = 200;

export interface ListBankTransactionParams extends ListQueryParams {
  page?: number;
  size?: number;
  /** Một hoặc nhiều trạng thái, nối bằng dấu phẩy; trống = tất cả. */
  status?: string;
  /** Ngày ngân hàng ghi, `YYYY-MM-DD` (giờ VN): BE `from` / `to` là Instant, `to` loại trừ. */
  from?: string;
  to?: string;
  /** bo-25: đúng số tiền (đồng) của giao dịch — BE `amount` (PR #497); BE cũ bỏ qua tham số. */
  amount?: number;
}

/** Giờ nghiệp vụ VN — BE lọc `from` / `to` theo Instant. */
const VN_OFFSET = "+07:00";
const DAY_MS = 24 * 60 * 60 * 1000;

/** `YYYY-MM-DD` (ngày VN) → Instant 00:00 ngày đó. */
export function dayStartInstant(day: string): string {
  return new Date(`${day}T00:00:00.000${VN_OFFSET}`).toISOString();
}

/** "Đến hết ngày `day`": BE lọc `transactionAt < to` → gửi 00:00 ngày hôm sau. */
export function dayAfterStartInstant(day: string): string {
  return new Date(new Date(`${day}T00:00:00.000${VN_OFFSET}`).getTime() + DAY_MS).toISOString();
}

/** Mới nhất trước (thứ tự cố định của BE). */
export async function listBankTransactions(
  params: ListBankTransactionParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<BankTransaction>> {
  const { page = 0, size = PAGE_SIZE.md, status, from, to, amount } = params;
  const query = new URLSearchParams({ page: String(Math.max(0, page)), size: String(size) });
  if (status) query.set("status", status);
  if (amount != null) query.set("amount", String(amount));
  if (from) query.set("from", dayStartInstant(from));
  if (to) query.set("to", dayAfterStartInstant(to));
  const { data } = await api.get<unknown>(BASE, { params: query, signal });
  return bankTransactionPageDtoSchema.parse(data);
}

export async function getBankTransaction(
  id: string,
  signal?: AbortSignal,
): Promise<BankTransaction> {
  const { data } = await api.get<unknown>(path(id), { signal });
  return bankTransactionDtoSchema.parse(data);
}

/** Mã tham chiếu và ngày nhận BE lấy từ giao dịch — FE không gửi. */
export async function assignBankTransaction(input: {
  id: string;
  body: AssignBody;
}): Promise<BankTransaction> {
  const { data } = await api.post<unknown>(path(input.id, "/assignment"), input.body);
  return bankTransactionDtoSchema.parse(data);
}

export async function ignoreBankTransaction(input: {
  id: string;
  reason: string;
}): Promise<BankTransaction> {
  const { data } = await api.post<unknown>(path(input.id, "/ignore"), { reason: input.reason });
  return bankTransactionDtoSchema.parse(data);
}

/** Số đợt tối đa một lần gợi ý "Đợt có thể khớp" — BE đã lọc đúng số tiền nên thường chỉ vài đợt. */
const MATCH_PAGE_SIZE = 50;

/**
 * Đợt còn phải thu ĐÚNG bằng `amount` (`GET /installments?outstanding=`, BE PR #497), hạn sớm nhất trước — khối "Đợt có
 * thể khớp" (bo-26). Giao dịch nhận ra khách → đợt của khách đó (`customerId`, kể cả đợt chưa đến hạn: khách trả trước);
 * không nhận ra → đợt đã đến hạn còn nợ của mọi khách (`owing=true`). Trả cả tổng để màn nói khi còn đợt ngoài trang.
 */
export async function listMatchingInstallments(
  params: { amount: number; customerId: string | null },
  signal?: AbortSignal,
): Promise<{ items: PayableInstallment[]; totalElements: number }> {
  const query = new URLSearchParams({
    outstanding: String(params.amount),
    page: "0",
    size: String(MATCH_PAGE_SIZE),
  });
  if (params.customerId) query.set("customerId", params.customerId);
  else query.set("owing", "true");
  const { data } = await api.get<unknown>("/installments", { params: query, signal });
  const page = payableInstallmentPageSchema.parse(data);
  return { items: page.items, totalElements: page.totalElements };
}

/**
 * Tìm đợt theo số hợp đồng / số đơn (hoặc tên / MST khách) của mọi khách — `GET /installments?search=` (bo-27, BE PR
 * #497 tìm thêm số hợp đồng / số đơn): hộp thoại gán tìm được đợt khi chưa biết khách.
 */
export async function searchInstallments(
  search: string,
  signal?: AbortSignal,
): Promise<PayableInstallment[]> {
  const query = new URLSearchParams({ search, page: "0", size: String(MATCH_PAGE_SIZE) });
  const { data } = await api.get<unknown>("/installments", { params: query, signal });
  return payableInstallmentPageSchema.parse(data).items;
}

/** Đợt của một khách (`GET /installments?customerId=`) — form chỉ giữ đợt còn phải thu. */
export async function listCustomerInstallments(
  customerId: string,
  signal?: AbortSignal,
): Promise<PayableInstallment[]> {
  const query = new URLSearchParams({ customerId, page: "0", size: String(MAX_PAGE_SIZE) });
  const { data } = await api.get<unknown>("/installments", { params: query, signal });
  return payableInstallmentPageSchema.parse(data).items;
}
