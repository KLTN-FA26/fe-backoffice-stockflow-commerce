/**
 * Báo giá / đơn của một khách (UI/UX bo-30): hai danh sách BE lọc theo `customerId`, mới nhất trước (thứ tự mặc định
 * của BE). Quyền: `sales-quotes:READ`, `sales-orders:READ` — trang gọi chỉ khi có.
 */

import { api } from "@/lib/api/client";

import { customerOrderPageSchema, customerQuotePageSchema } from "./documents-schemas";

import type { PaginatedResponse } from "@/lib/api/query-factory";
import type { CustomerOrderRow, CustomerQuoteRow } from "./types";

export interface CustomerDocumentsParams {
  customerId: string;
  /** Trang đánh số từ 0 (BE `PageResponse`). */
  page: number;
  size: number;
}

const paramsOf = ({ customerId, page, size }: CustomerDocumentsParams) =>
  new URLSearchParams({ customerId, page: String(Math.max(0, page)), size: String(size) });

export async function listCustomerQuotes(
  params: CustomerDocumentsParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<CustomerQuoteRow>> {
  const { data } = await api.get<unknown>("/quotes", { params: paramsOf(params), signal });
  return customerQuotePageSchema.parse(data);
}

export async function listCustomerOrders(
  params: CustomerDocumentsParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<CustomerOrderRow>> {
  const { data } = await api.get<unknown>("/orders", { params: paramsOf(params), signal });
  return customerOrderPageSchema.parse(data);
}
