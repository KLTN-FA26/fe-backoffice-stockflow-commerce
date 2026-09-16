import { PAGE_SIZE } from "@/constants";

import { api } from "@/lib/api/client";

import type { PaginatedResponse } from "@/lib/api/query-factory";
import type { Lot, Receipt } from "./types";

export interface ListReceiptParams {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string[];
  sort?: string;
  [key: string]: unknown;
}

export async function listReceipts(
  params: ListReceiptParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<Receipt>> {
  const { data } = await api.get<PaginatedResponse<Receipt>>("/receipts", {
    params,
    signal,
  });
  return data;
}

export async function getReceipt(id: string, signal?: AbortSignal): Promise<Receipt> {
  const { data } = await api.get<Receipt>(`/receipts/${id}`, { signal });
  return data;
}

export async function listReceiptLots(signal?: AbortSignal): Promise<PaginatedResponse<Lot>> {
  const { data } = await api.get<PaginatedResponse<Lot>>("/lots", {
    params: { pageSize: PAGE_SIZE.masterData },
    signal,
  });
  return data;
}
