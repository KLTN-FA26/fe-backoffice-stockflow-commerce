/**
 * Supplier — API layer.
 *
 * Thin wrappers around axios calls. When USE_MOCK=true the
 * mock adapter intercepts these and returns data from mock-data.ts.
 *
 * Backend: SCRUM-118 (Hoang Minh Vo, this sprint).
 * Parse at boundary (api-conventions §3.2) — zod validates once here.
 */

import { api } from "@/lib/api/client";
import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";

import { paginatedSupplierDtoSchema, supplierDtoSchema } from "./schemas";

import type {
  SupplierDto,
  SupplierCreateInput,
  SupplierUpdateInput,
  SupplierToggleStatusInput,
} from "./types";

/* ── List ────────────────────────────────────────────────────────────── */

export interface ListSupplierParams extends ListQueryParams {
  status?: string[];
}

export async function listSuppliers(
  params: ListSupplierParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<SupplierDto>> {
  const { data } = await api.get<PaginatedResponse<SupplierDto>>("/suppliers", {
    params,
    signal,
  });
  return paginatedSupplierDtoSchema.parse(data);
}

/* ── Detail ──────────────────────────────────────────────────────────── */

export async function getSupplier(id: string, signal?: AbortSignal): Promise<SupplierDto> {
  const { data } = await api.get<SupplierDto>(`/suppliers/${id}`, { signal });
  return supplierDtoSchema.parse(data);
}

/* ── Create ──────────────────────────────────────────────────────────── */

export async function createSupplier(input: SupplierCreateInput): Promise<SupplierDto> {
  const { data } = await api.post<SupplierDto>("/suppliers", input);
  return supplierDtoSchema.parse(data);
}

/* ── Update ──────────────────────────────────────────────────────────── */

export async function updateSupplier(input: SupplierUpdateInput): Promise<SupplierDto> {
  const { id, ...body } = input;
  const { data } = await api.put<SupplierDto>(`/suppliers/${id}`, body);
  return supplierDtoSchema.parse(data);
}

/* ── Toggle status ───────────────────────────────────────────────────── */

export async function toggleSupplierStatus(input: SupplierToggleStatusInput): Promise<SupplierDto> {
  const { id, ...body } = input;
  const { data } = await api.patch<SupplierDto>(`/suppliers/${id}/status`, body);
  return supplierDtoSchema.parse(data);
}
