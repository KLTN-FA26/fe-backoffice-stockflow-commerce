import { PAGE_SIZE } from "@/constants";

import { api } from "@/lib/api/client";

import type { PaginatedResponse } from "@/lib/api/query-factory";
import type { Invoice } from "./types";

export interface ListInvoiceParams {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string[];
  sort?: string;
  [key: string]: unknown;
}

export async function listInvoices(
  params: ListInvoiceParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<Invoice>> {
  const { data } = await api.get<PaginatedResponse<Invoice>>("/invoices", {
    params: { ...params, pageSize: params.pageSize ?? PAGE_SIZE.masterData },
    signal,
  });
  return data;
}

export async function getInvoice(id: string, signal?: AbortSignal): Promise<Invoice> {
  const { data } = await api.get<Invoice>(`/invoices/${id}`, { signal });
  return data;
}
