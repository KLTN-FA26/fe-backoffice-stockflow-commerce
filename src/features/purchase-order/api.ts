/**
 * Purchase Order — API layer (BE `PurchaseOrderController` + `PurchaseOrderDeliveryController`,
 * nhánh BE `test`). Path KHÔNG ghi `/v1`: axios `baseURL: "/api"`, next.config rewrite sang
 * `${API_URL}` (đã gồm `/api/v1`). BE bọc ApiResponse — đã bóc ở `lib/api/client.ts`.
 *
 * Mọi response được zod `.parse` MỘT lần ở đây (sai hợp đồng → ZodError → "invalid-data"),
 * rồi map sang FE view (`mappers.ts`). Mock adapter trả đúng hình BE nên chỉ có một luồng.
 */

import { PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";

import { mapBePoToFe } from "./mappers";
import {
  beDeliveryAttemptSchema,
  beDeliveryDecisionSchema,
  bePageSchema,
  bePoStatusCountSchema,
  bePurchaseOrderSchema,
  beSupplierSpendSchema,
} from "./schemas";

import type { PaginatedResponse } from "@/lib/api/query-factory";
import type {
  CreatePoInput,
  DeliveryAttempt,
  DeliveryDecision,
  PoStatusCount,
  RecoverDeliveryInput,
  SendPoInput,
  SupplierConfirmationInput,
  SupplierSpendRow,
} from "./schemas";
import type { PoStatus, PurchaseOrder } from "./types";

const PO_PATH = "/purchase-orders";
const poPageSchema = bePageSchema(bePurchaseOrderSchema);
const spendPageSchema = bePageSchema(beSupplierSpendSchema);
const deliveryPageSchema = bePageSchema(beDeliveryAttemptSchema);
const decisionPageSchema = bePageSchema(beDeliveryDecisionSchema);

/** Spring bind `@RequestParam List<String> status` từ `status=A&status=B`, không phải `status[]=`. */
const REPEAT_ARRAY_PARAMS = { indexes: null } as const;

async function postPo(path: string, body?: unknown): Promise<PurchaseOrder> {
  const { data } = await api.post<unknown>(path, body);
  return mapBePoToFe(bePurchaseOrderSchema.parse(data));
}

/* ── List / detail ───────────────────────────────────────────────────── */

export interface ListPoParams {
  /** Trang từ 0 (BE PageResponse). */
  page?: number;
  size?: number;
  status?: PoStatus[];
  supplierId?: string;
  /** BE SortWhitelist: "prop,dir;prop2,dir2". */
  sort?: string;
  [key: string]: unknown;
}

export async function listPurchaseOrders(
  params: ListPoParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<PurchaseOrder>> {
  const { data } = await api.get<unknown>(PO_PATH, {
    params: {
      page: params.page ?? 0,
      size: params.size ?? PAGE_SIZE.md,
      supplierId: params.supplierId,
      status: params.status,
      sort: params.sort,
    },
    paramsSerializer: REPEAT_ARRAY_PARAMS,
    signal,
  });
  const page = poPageSchema.parse(data);
  return { ...page, items: page.items.map(mapBePoToFe) };
}

export async function getPurchaseOrder(id: string, signal?: AbortSignal): Promise<PurchaseOrder> {
  const { data } = await api.get<unknown>(`${PO_PATH}/${id}`, { signal });
  return mapBePoToFe(bePurchaseOrderSchema.parse(data));
}

export interface PoHistoryParams {
  /** Trang từ 0 (BE PageResponse). */
  page: number;
  size: number;
}

export async function listPoDeliveries(
  id: string,
  params: PoHistoryParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<DeliveryAttempt>> {
  const { data } = await api.get<unknown>(`${PO_PATH}/${id}/deliveries`, { params, signal });
  return deliveryPageSchema.parse(data);
}

/** Ai cho phép gửi lần đầu / khôi phục gửi, đổi ngày giao, lý do (`/delivery-decisions`). */
export async function listPoDeliveryDecisions(
  id: string,
  params: PoHistoryParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<DeliveryDecision>> {
  const { data } = await api.get<unknown>(`${PO_PATH}/${id}/delivery-decisions`, {
    params,
    signal,
  });
  return decisionPageSchema.parse(data);
}

/* ── Create / lifecycle ──────────────────────────────────────────────── */

export interface CreatePoResult extends PurchaseOrder {
  /** BR-PO-003: chỉ cảnh báo — có PO mở khác cùng NCC + ngày giao + SKU. */
  possibleDuplicate: boolean;
}

export async function createPurchaseOrder(input: CreatePoInput): Promise<CreatePoResult> {
  const { data } = await api.post<unknown>(PO_PATH, input);
  const be = bePurchaseOrderSchema.parse(data);
  return { ...mapBePoToFe(be), possibleDuplicate: be.possibleDuplicate };
}

export const approvePurchaseOrder = (id: string) => postPo(`${PO_PATH}/${id}/approval`);
/** BE: chỉ gửi `reason` khi đổi ngày giao; body rỗng cũng hợp lệ. */
export const sendPurchaseOrder = (id: string, input: SendPoInput) =>
  postPo(`${PO_PATH}/${id}/sending`, {
    expectedAt: input.expectedAt,
    reason: input.reason || undefined,
  });
export const cancelPurchaseOrder = (id: string, reason: string) =>
  postPo(`${PO_PATH}/${id}/cancellation`, { reason });
export const closeShortPurchaseOrder = (id: string, reason: string) =>
  postPo(`${PO_PATH}/${id}/closure-short`, { reason });
export const recoverPoDelivery = (id: string, input: RecoverDeliveryInput) =>
  postPo(`${PO_PATH}/${id}/delivery-recovery`, input);
export const recordSupplierConfirmation = (id: string, input: SupplierConfirmationInput) =>
  postPo(`${PO_PATH}/${id}/supplier-confirmation`, {
    status: input.status,
    supplierReference: input.supplierReference || undefined,
    note: input.note || undefined,
  });

/* ── Reports ─────────────────────────────────────────────────────────── */

export async function fetchPoStatusDashboard(signal?: AbortSignal): Promise<PoStatusCount[]> {
  const { data } = await api.get<unknown>(`${PO_PATH}/reports/status-dashboard`, { signal });
  return bePoStatusCountSchema.array().parse(data);
}

export interface SupplierSpendParams {
  page?: number;
  size?: number;
  supplierId?: string;
  /** BE #40: lọc một tiền tệ (nhánh BE chưa có #40 bỏ qua param này). */
  currency?: string;
  expectedAtFrom?: string;
  expectedAtTo?: string;
  [key: string]: unknown;
}

export async function listSupplierSpend(
  params: SupplierSpendParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<SupplierSpendRow>> {
  const { data } = await api.get<unknown>(`${PO_PATH}/reports/supplier-spend`, {
    params: {
      page: params.page ?? 0,
      size: params.size ?? PAGE_SIZE.md,
      supplierId: params.supplierId,
      currency: params.currency,
      expectedAtFrom: params.expectedAtFrom,
      expectedAtTo: params.expectedAtTo,
    },
    signal,
  });
  return spendPageSchema.parse(data);
}
