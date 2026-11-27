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
  const { page = 0, size = PAGE_SIZE.md, status, from, to } = params;
  const query = new URLSearchParams({ page: String(Math.max(0, page)), size: String(size) });
  if (status) query.set("status", status);
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

/**
 * Đợt đã đến hạn còn phải thu của mọi khách (`GET /installments?owing=true`, hạn sớm nhất trước), tối đa một trang
 * 200 dòng — để gợi ý đợt cùng số tiền khi giao dịch không nhận ra khách. BE chưa lọc theo số tiền, nên trả cả tổng để
 * màn nói rõ phạm vi khi vượt 200.
 */
export async function listOwingInstallments(
  signal?: AbortSignal,
): Promise<{ items: PayableInstallment[]; totalElements: number }> {
  const query = new URLSearchParams({ owing: "true", page: "0", size: String(MAX_PAGE_SIZE) });
  const { data } = await api.get<unknown>("/installments", { params: query, signal });
  const page = payableInstallmentPageSchema.parse(data);
  return { items: page.items, totalElements: page.totalElements };
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
