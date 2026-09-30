/**
 * Purchase Order — API layer.
 *
 * Contract: BE Procurement (PurchaseOrderController.java + DTOs).
 * - POST /purchase-orders                    {supplierId:UUID, currency, expectedAt, lines:[{sku,description,quantityOrdered,unitPrice}]}
 * - GET  /purchase-orders?page=&size=&supplierId=&status=&sort=   (PageResponse, page 0-based)
 * - GET  /purchase-orders/{purchaseOrderId}
 * - POST /purchase-orders/{id}/approval | /sending | /cancellation {reason} | /closure-short {reason}
 * - POST /purchase-orders/{id}/receipts      {lines:[{lineId:UUID, quantity}]}
 * - GET  /purchase-orders/reports/status-dashboard | /reports/supplier-spend
 *
 * Paths carry NO `/v1`: axios `baseURL` is "/api" and next.config rewrites it to
 * `${API_URL}`, where API_URL already ends in `/api/v1`.
 *
 * BE wraps every response in ApiResponse {success, data} — unwrapped in lib/api/client.ts.
 * Every PO response is zod-parsed here, once, then mapped (mappers.ts). The mock adapter
 * returns the exact BE wire shape, so there is a single code path for mock and real BE.
 */

import { PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";
import { parseResponse } from "@/lib/api/parse";

import { mapBePoToFe } from "./mappers";
import {
  bePageSchema,
  bePoStatusCountSchema,
  bePurchaseOrderSchema,
  beSupplierSpendSchema,
} from "./schemas";

import type { PaginatedResponse } from "@/lib/api/query-factory";
import type { CreatePoInput, PoStatusCount, SupplierSpendRow } from "./schemas";
import type { PoStatus, PurchaseOrder, ReplenishmentProposal, Supplier, Warehouse } from "./types";

const PO_PATH = "/purchase-orders";
const bePoPageSchema = bePageSchema(bePurchaseOrderSchema);
const beSpendPageSchema = bePageSchema(beSupplierSpendSchema);

/** Spring binds `@RequestParam List<String> status` from `status=A&status=B`, not `status[]=`. */
const REPEAT_ARRAY_PARAMS = { indexes: null } as const;

async function postPo(path: string, body?: unknown): Promise<PurchaseOrder> {
  const { data } = await api.post<unknown>(path, body);
  return mapBePoToFe(parseResponse(bePurchaseOrderSchema, data, `POST ${path}`));
}

/* ── List ────────────────────────────────────────────────────────────── */

export interface ListPoParams {
  /** 1-based (UI); converted to BE 0-based. */
  page?: number;
  pageSize?: number;
  status?: PoStatus[];
  supplierId?: string;
  /** BE SortWhitelist format: "prop,dir;prop2,dir2". */
  sort?: string;
  [key: string]: unknown;
}

export async function listPurchaseOrders(
  params: ListPoParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<PurchaseOrder>> {
  const page = params.page ?? 1;
  const { data } = await api.get<unknown>(PO_PATH, {
    params: {
      page: Math.max(0, page - 1),
      size: params.pageSize ?? PAGE_SIZE.md,
      supplierId: params.supplierId,
      status: params.status,
      sort: params.sort,
    },
    paramsSerializer: REPEAT_ARRAY_PARAMS,
    signal,
  });
  const be = parseResponse(bePoPageSchema, data, `GET ${PO_PATH}`);
  return { items: be.items.map(mapBePoToFe), total: be.totalElements, page, pageSize: be.size };
}

/* ── Detail / create / lifecycle ─────────────────────────────────────── */

export async function getPurchaseOrder(id: string, signal?: AbortSignal): Promise<PurchaseOrder> {
  const { data } = await api.get<unknown>(`${PO_PATH}/${id}`, { signal });
  return mapBePoToFe(parseResponse(bePurchaseOrderSchema, data, `GET ${PO_PATH}/{id}`));
}

export interface CreatePoResult extends PurchaseOrder {
  /** BR-PO-003: warning only — another open PO with same supplier + expectedAt + SKU exists. */
  possibleDuplicate: boolean;
}

export async function createPurchaseOrder(input: CreatePoInput): Promise<CreatePoResult> {
  const { data } = await api.post<unknown>(PO_PATH, input);
  const be = parseResponse(bePurchaseOrderSchema, data, `POST ${PO_PATH}`);
  return { ...mapBePoToFe(be), possibleDuplicate: be.possibleDuplicate };
}

export const approvePurchaseOrder = (id: string) => postPo(`${PO_PATH}/${id}/approval`);
export const sendPurchaseOrder = (id: string) => postPo(`${PO_PATH}/${id}/sending`);
export const cancelPurchaseOrder = (id: string, reason: string) =>
  postPo(`${PO_PATH}/${id}/cancellation`, { reason });
export const closeShortPurchaseOrder = (id: string, reason: string) =>
  postPo(`${PO_PATH}/${id}/closure-short`, { reason });

export interface ReceiveLineInput {
  lineId: string;
  quantity: number;
}

export const receiveGoods = (id: string, lines: ReceiveLineInput[]) =>
  postPo(`${PO_PATH}/${id}/receipts`, { lines });

/* ── Reports ─────────────────────────────────────────────────────────── */

export async function fetchPoStatusDashboard(signal?: AbortSignal): Promise<PoStatusCount[]> {
  const path = `${PO_PATH}/reports/status-dashboard`;
  const { data } = await api.get<unknown>(path, { signal });
  return parseResponse(bePoStatusCountSchema.array(), data, `GET ${path}`);
}

export interface SupplierSpendParams {
  page?: number;
  pageSize?: number;
  supplierId?: string;
  expectedAtFrom?: string;
  expectedAtTo?: string;
  [key: string]: unknown;
}

export async function listSupplierSpend(
  params: SupplierSpendParams = {},
  signal?: AbortSignal,
): Promise<PaginatedResponse<SupplierSpendRow>> {
  const path = `${PO_PATH}/reports/supplier-spend`;
  const page = params.page ?? 1;
  const { data } = await api.get<unknown>(path, {
    params: {
      page: Math.max(0, page - 1),
      size: params.pageSize ?? PAGE_SIZE.md,
      supplierId: params.supplierId,
      expectedAtFrom: params.expectedAtFrom,
      expectedAtTo: params.expectedAtTo,
    },
    signal,
  });
  const be = parseResponse(beSpendPageSchema, data, `GET ${path}`);
  return { items: be.items, total: be.totalElements, page, pageSize: be.size };
}

/* ── Master data — FE-ONLY ─────────────────────────────────────────────
 * BE has no GET /api/v1/suppliers, /warehouses (WarehouseController is a stub) or
 * /replenishment-proposals yet. These calls are served by the mock adapter
 * (lib/api/mock-routes.ts) so the PO create/list/detail screens can run end-to-end.
 * Against the real BE they 404 and the screens show an inline "không tải được" notice
 * instead of an empty select. Replace with the real endpoints once BE ships them.
 */

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
  const { data } = await api.get<PaginatedResponse<Warehouse>>("/warehouses", { signal });
  return data;
}

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
