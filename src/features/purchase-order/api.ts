/**
 * Purchase Order — API layer.
 *
 * Thin wrappers around axios calls. When USE_MOCK=true the
 * mock adapter intercepts these and returns data from mock-data.ts.
 */

import { PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";
import type { PaginatedResponse } from "@/lib/api/query-factory";
import type { PurchaseOrder, ReplenishmentProposal, Supplier, Warehouse } from "./types";

/* ── List ────────────────────────────────────────────────────────────── */

export interface ListPoParams {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string[];
  sort?: string;
  [key: string]: unknown;
}

export async function listPurchaseOrders(
  params: ListPoParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<PurchaseOrder>> {
  const { data } = await api.get<PaginatedResponse<PurchaseOrder>>("/purchase-orders", {
    params,
    signal,
  });
  return data;
}

/* ── Detail ──────────────────────────────────────────────────────────── */

export async function getPurchaseOrder(id: string, signal?: AbortSignal): Promise<PurchaseOrder> {
  const { data } = await api.get<PurchaseOrder>(`/purchase-orders/${id}`, {
    signal,
  });
  return data;
}

/* ── Create ──────────────────────────────────────────────────────────── */

export interface CreatePoInput {
  supplierId: string;
  warehouseId: string;
  currency: string;
  expectedDate: string;
  lines: {
    skuId: string;
    orderedQty: number;
    unitPrice: number;
    taxRate: number;
    discountRate: number;
    uom: string;
  }[];
  notes?: string;
  fromProposalId?: string;
}

export async function createPurchaseOrder(input: CreatePoInput): Promise<PurchaseOrder> {
  const { data } = await api.post<PurchaseOrder>("/purchase-orders", input);
  return data;
}

/* ── Update ──────────────────────────────────────────────────────────── */

export async function updatePurchaseOrder(
  input: { id: string } & Partial<CreatePoInput>,
): Promise<PurchaseOrder> {
  const { id, ...body } = input;
  const { data } = await api.put<PurchaseOrder>(`/purchase-orders/${id}`, body);
  return data;
}

/* ── Status transition ───────────────────────────────────────────────── */

export interface TransitionPoInput {
  id: string;
  targetStatus: string;
  reason?: string;
}

export async function transitionPurchaseOrder(input: TransitionPoInput): Promise<PurchaseOrder> {
  const { id, ...body } = input;
  const { data } = await api.patch<PurchaseOrder>(`/purchase-orders/${id}/status`, body);
  return data;
}

/* ── Replenishment ───────────────────────────────────────────────────── */

export async function listReplenishmentProposals(
  params: { page?: number; pageSize?: number },
  signal?: AbortSignal,
): Promise<PaginatedResponse<ReplenishmentProposal>> {
  const { data } = await api.get<PaginatedResponse<ReplenishmentProposal>>(
    "/replenishment-proposals",
    { params, signal },
  );
  return data;
}

export async function listPoSuppliers(signal?: AbortSignal): Promise<PaginatedResponse<Supplier>> {
  const { data } = await api.get<PaginatedResponse<Supplier>>("/suppliers", {
    params: { pageSize: PAGE_SIZE.masterData },
    signal,
  });
  return data;
}

export async function listPoWarehouses(
  signal?: AbortSignal,
): Promise<PaginatedResponse<Warehouse>> {
  const { data } = await api.get<PaginatedResponse<Warehouse>>("/warehouses", {
    signal,
  });
  return data;
}
