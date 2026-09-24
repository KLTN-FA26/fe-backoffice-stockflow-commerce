/**
 * Purchase Order — API layer.
 *
 * Contract: BE Procurement (PurchaseOrderController.java + DTOs).
 * - POST   /purchase-orders                          {supplierId:UUID, currency, expectedAt, lines:[{sku,description,quantityOrdered,unitPrice}]}
 * - GET    /purchase-orders?page=&size=&supplierId=&status=&sort=  (PageResponse, page 0-based)
 * - GET    /purchase-orders/{purchaseOrderId:UUID}
 * - POST   /purchase-orders/{id}/approval
 * - POST   /purchase-orders/{id}/sending
 * - POST   /purchase-orders/{id}/cancellation        {reason}
 * - POST   /purchase-orders/{id}/closure-short       {reason}
 * - POST   /purchase-orders/{id}/receipts            {lines:[{lineId:UUID, quantity}]}
 *
 * BE wraps every response in ApiResponse {success, data, ...} — unwrapped in lib/api/client.ts.
 */

import { PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";
import type { PaginatedResponse } from "@/lib/api/query-factory";

import type { PurchaseOrder, ReplenishmentProposal, Supplier, Warehouse } from "./types";

/* ── BE wire types ─────────────────────────────────────────────────── */

export interface BePOLine {
  lineId: string;
  sku: string;
  description?: string | null;
  quantityOrdered: number;
  quantityReceived: number;
  openQuantity: number;
  unitPrice: number | string;
}

export interface BePurchaseOrder {
  purchaseOrderId: string;
  poNumber: string;
  supplierId: string;
  status: string;
  currency: string;
  totalAmount: number | string;
  expectedAt: string | null;
  lines: BePOLine[];
  createdAt: string;
  createdBy: string;
  lastModifiedAt: string;
  lastModifiedBy: string;
  possibleDuplicate: boolean;
  cancellationReason?: string | null;
  closeShortReason?: string | null;
}

export interface BePageResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/* ── FE helpers ────────────────────────────────────────────────────── */

function toNumber(v: number | string | null | undefined): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v) || 0;
  return 0;
}

function mapBeLine(be: BePOLine, poId: string): PurchaseOrder["lines"][number] {
  return {
    lineId: be.lineId,
    poId,
    skuId: be.sku,
    orderedQty: be.quantityOrdered,
    receivedQty: be.quantityReceived,
    unitPrice: toNumber(be.unitPrice),
    currency: "VND" as PurchaseOrder["lines"][number]["currency"],
    taxRate: 0,
    discountRate: 0,
    uom: "pcs",
    lineTotal: be.quantityOrdered * toNumber(be.unitPrice),
  } as PurchaseOrder["lines"][number];
}

export function mapBePoToFe(be: BePurchaseOrder): PurchaseOrder {
  const poId = be.purchaseOrderId;
  const currency = (
    be.currency === "VND" || be.currency === "USD" || be.currency === "CNY" ? be.currency : "VND"
  ) as PurchaseOrder["currency"];
  const lines = (be.lines ?? []).map((l) => {
    const m = mapBeLine(l, poId);
    return { ...m, currency } as PurchaseOrder["lines"][number];
  });
  const total = toNumber(be.totalAmount);
  // Normalize ngay tại biên API — mock-adapter có thể trả về Title Case
  // legacy ("Draft", "Confirmed", "Partially Received") trong khi FE canonical
  // là SCREAMING_SNAKE ("DRAFT", "SENT", ...). Không normalize ở đây thì mọi
  // consumer (detail timeline, action-gating, status badge) đều phải tự normalize
  // và dễ sót, từng gây crash `isTerminal(undefined.length)` ở detail.
  const normalizedStatus = normalizeApiStatus(be.status);
  return {
    poId,
    poNumber: be.poNumber,
    supplierId: be.supplierId,
    status: normalizedStatus as unknown as PurchaseOrder["status"],
    warehouseId: "WH-HN-01" as PurchaseOrder["warehouseId"],
    currency,
    orderDate: be.createdAt ? be.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
    expectedDate: be.expectedAt ?? "",
    createdBy: be.createdBy ?? "",
    approvedBy: undefined,
    approvalNote: undefined,
    rejectionReason: (be.cancellationReason ?? be.closeShortReason ?? undefined) as
      string | undefined,
    subtotal: total,
    taxTotal: 0,
    grandTotal: total,
    lines,
    notes: undefined,
    fromProposalId: undefined,
    revisionOf: undefined,
  } as PurchaseOrder;
}

/**
 * Chuẩn hóa status từ wire (BE hoặc mock-adapter) về canonical BE.
 *
 * Dual-source giống `normalizePoStatus()` trong `lifecycle.ts` nhưng đặt ở
 * tầng API để FE còn lại chỉ làm việc với SCREAMING_SNAKE:
 * - BE thật đã trả SCREAMING_SNAKE → `upper` giữ nguyên, `legacyMap[upper]`
 *   thường là identity (giữ nguyên).
 * - Mock adapter trả Title Case (`Draft`, `Approved`, `Confirmed`, `Received`) →
 *   `toUpperCase + replace` đổi về `DRAFT`/`APPROVED`/`CONFIRMED`/..., rồi
 *   `legacyMap` xử lý các trường hợp BE đã đổi semantics (mock `Confirmed`
 *   ≈ BE `SENT`, mock `Received` ≈ BE `CLOSED`, theo narrowed 7-state
 *   SCRUM-113/116). Empty string → `DRAFT` để không trả về `""` cho UI.
 */
function normalizeApiStatus(status: string): string {
  if (!status) return "DRAFT";
  const upper = status.toUpperCase().replace(/[\s-]+/g, "_");
  // Legacy mock Title Case → BE screaming snake
  const legacyMap: Record<string, string> = {
    DRAFT: "DRAFT",
    PENDING_APPROVAL: "APPROVED",
    APPROVED: "APPROVED",
    CONFIRMED: "SENT",
    PARTIALLY_RECEIVED: "PARTIALLY_RECEIVED",
    RECEIVED: "CLOSED",
    CLOSED: "CLOSED",
    CANCELLED: "CANCELLED",
  };
  return legacyMap[upper] ?? upper;
}

function mapBePage<T, U>(
  be: BePageResponse<T>,
  mapItem: (t: T) => U,
  page1Based: number,
): PaginatedResponse<U> {
  return {
    items: (be.items ?? []).map(mapItem),
    total: be.totalElements,
    page: page1Based,
    pageSize: be.size,
  };
}

/* ── List ────────────────────────────────────────────────────────────── */

export interface ListPoParams {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string[];
  supplierId?: string;
  sort?: string;
  [key: string]: unknown;
}

export async function listPurchaseOrders(
  params: ListPoParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<PurchaseOrder>> {
  const page1 = params.page ?? 1;
  const size = params.pageSize ?? PAGE_SIZE.md;
  const beParams: Record<string, unknown> = {
    page: Math.max(0, page1 - 1),
    size,
    supplierId: params.supplierId,
    status: params.status,
    sort: params.sort,
    q: params.q,
  };
  const { data } = await api.get<
    BePageResponse<BePurchaseOrder> | PaginatedResponse<PurchaseOrder>
  >("/purchase-orders", { params: beParams, signal });
  if (
    data &&
    typeof data === "object" &&
    "totalElements" in (data as unknown as Record<string, unknown>)
  ) {
    const bePage = data as BePageResponse<BePurchaseOrder>;
    const first = bePage.items?.[0] as unknown as Record<string, unknown> | undefined;
    const isBeShape = !!first && "purchaseOrderId" in first;
    if (isBeShape) {
      return mapBePage(bePage, mapBePoToFe, page1);
    }
    // Mock adapter returns BE page envelope but FE items (has poId, not purchaseOrderId)
    return {
      items: (bePage.items as unknown as PurchaseOrder[]).slice(),
      total: bePage.totalElements,
      page: page1,
      pageSize: bePage.size,
    };
  }
  return data as PaginatedResponse<PurchaseOrder>;
}

/* ── Detail ──────────────────────────────────────────────────────────── */

export async function getPurchaseOrder(id: string, signal?: AbortSignal): Promise<PurchaseOrder> {
  const { data } = await api.get<BePurchaseOrder | PurchaseOrder>(`/purchase-orders/${id}`, {
    signal,
  });
  if (
    data &&
    typeof data === "object" &&
    "purchaseOrderId" in (data as unknown as Record<string, unknown>)
  ) {
    return mapBePoToFe(data as BePurchaseOrder);
  }
  return data as PurchaseOrder;
}

/* ── Create ──────────────────────────────────────────────────────────── */

export interface CreatePoInput {
  supplierId: string;
  currency: string;
  expectedAt: string;
  lines: {
    sku: string;
    description?: string;
    quantityOrdered: number;
    unitPrice: number;
  }[];
  warehouseId?: string;
  expectedDate?: string;
  notes?: string;
  fromProposalId?: string;
}

export interface CreatePoResult extends PurchaseOrder {
  possibleDuplicate?: boolean;
}

function toBeCreateBody(input: CreatePoInput): Record<string, unknown> {
  const lines = (input.lines ?? []).map((l) => {
    const raw = l as unknown as Record<string, unknown>;
    const sku = (raw.sku as string) ?? (raw.skuId as string) ?? "";
    const qty = (raw.quantityOrdered as number) ?? (raw.orderedQty as number) ?? 0;
    return {
      sku,
      description: (raw.description as string) ?? null,
      quantityOrdered: qty,
      unitPrice: (raw.unitPrice as number) ?? 0,
    };
  });
  return {
    supplierId: input.supplierId,
    currency: input.currency,
    expectedAt: input.expectedAt ?? input.expectedDate ?? null,
    lines,
  };
}

export async function createPurchaseOrder(input: CreatePoInput): Promise<CreatePoResult> {
  const body = toBeCreateBody(input);
  const { data } = await api.post<BePurchaseOrder | CreatePoResult>("/purchase-orders", body);
  if (
    data &&
    typeof data === "object" &&
    "purchaseOrderId" in (data as unknown as Record<string, unknown>)
  ) {
    const be = data as BePurchaseOrder;
    const fe = mapBePoToFe(be);
    return { ...fe, possibleDuplicate: be.possibleDuplicate } as CreatePoResult;
  }
  return data as CreatePoResult;
}

/* ── Lifecycle — one endpoint per action (BE split for permission) ── */

export async function approvePurchaseOrder(id: string): Promise<PurchaseOrder> {
  const { data } = await api.post<BePurchaseOrder | PurchaseOrder>(
    `/purchase-orders/${id}/approval`,
  );
  if (
    data &&
    typeof data === "object" &&
    "purchaseOrderId" in (data as unknown as Record<string, unknown>)
  ) {
    return mapBePoToFe(data as BePurchaseOrder);
  }
  return data as PurchaseOrder;
}

export async function sendPurchaseOrder(id: string): Promise<PurchaseOrder> {
  const { data } = await api.post<BePurchaseOrder | PurchaseOrder>(
    `/purchase-orders/${id}/sending`,
  );
  if (
    data &&
    typeof data === "object" &&
    "purchaseOrderId" in (data as unknown as Record<string, unknown>)
  ) {
    return mapBePoToFe(data as BePurchaseOrder);
  }
  return data as PurchaseOrder;
}

export async function cancelPurchaseOrder(id: string, reason: string): Promise<PurchaseOrder> {
  const { data } = await api.post<BePurchaseOrder | PurchaseOrder>(
    `/purchase-orders/${id}/cancellation`,
    { reason },
  );
  if (
    data &&
    typeof data === "object" &&
    "purchaseOrderId" in (data as unknown as Record<string, unknown>)
  ) {
    return mapBePoToFe(data as BePurchaseOrder);
  }
  return data as PurchaseOrder;
}

export async function closeShortPurchaseOrder(id: string, reason: string): Promise<PurchaseOrder> {
  const { data } = await api.post<BePurchaseOrder | PurchaseOrder>(
    `/purchase-orders/${id}/closure-short`,
    { reason },
  );
  if (
    data &&
    typeof data === "object" &&
    "purchaseOrderId" in (data as unknown as Record<string, unknown>)
  ) {
    return mapBePoToFe(data as BePurchaseOrder);
  }
  return data as PurchaseOrder;
}

export async function receiveGoods(
  id: string,
  lines: { lineId: string; quantity: number }[],
): Promise<PurchaseOrder> {
  const { data } = await api.post<BePurchaseOrder | PurchaseOrder>(
    `/purchase-orders/${id}/receipts`,
    { lines },
  );
  if (
    data &&
    typeof data === "object" &&
    "purchaseOrderId" in (data as unknown as Record<string, unknown>)
  ) {
    return mapBePoToFe(data as BePurchaseOrder);
  }
  return data as PurchaseOrder;
}

/* Deprecated compat — delegates to per-action endpoints */
export interface TransitionPoInput {
  id: string;
  action: "approve" | "send" | "cancel" | "closeShort";
  reason?: string;
}

export async function transitionPurchaseOrder(input: TransitionPoInput): Promise<PurchaseOrder> {
  switch (input.action) {
    case "approve":
      return approvePurchaseOrder(input.id);
    case "send":
      return sendPurchaseOrder(input.id);
    case "cancel":
      return cancelPurchaseOrder(input.id, input.reason ?? "");
    case "closeShort":
      return closeShortPurchaseOrder(input.id, input.reason ?? "");
    default:
      throw new Error(`Unknown PO action: ${(input as { action: string }).action}`);
  }
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

/* ── Dashboard — GET /purchase-orders/reports/status-dashboard ─────── */

export interface PoStatusCount {
  status: string;
  count: number;
}

export async function fetchPoStatusDashboard(signal?: AbortSignal): Promise<PoStatusCount[]> {
  const { data } = await api.get<PoStatusCount[] | BePageResponse<PoStatusCount>>(
    "/purchase-orders/reports/status-dashboard",
    { signal },
  );
  if (Array.isArray(data)) return data;
  // Defensive: if wrapped differently, extract items
  if (data && typeof data === "object" && "items" in (data as unknown as Record<string, unknown>)) {
    return (data as unknown as { items: PoStatusCount[] }).items;
  }
  return [];
}

/* ── Reports — GET /purchase-orders/reports/supplier-spend ────────────── */

export interface SupplierSpendRow {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  totalSpend: number | string;
  purchaseOrderCount: number;
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
  const page1 = params.page ?? 1;
  const beParams: Record<string, unknown> = {
    page: Math.max(0, page1 - 1),
    size: params.pageSize ?? PAGE_SIZE.md,
    supplierId: params.supplierId,
    expectedAtFrom: params.expectedAtFrom,
    expectedAtTo: params.expectedAtTo,
  };
  const { data } = await api.get<
    BePageResponse<SupplierSpendRow> | PaginatedResponse<SupplierSpendRow>
  >("/purchase-orders/reports/supplier-spend", { params: beParams, signal });
  if (
    data &&
    typeof data === "object" &&
    "totalElements" in (data as unknown as Record<string, unknown>)
  ) {
    const be = data as BePageResponse<SupplierSpendRow>;
    return { items: be.items ?? [], total: be.totalElements, page: page1, pageSize: be.size };
  }
  return data as PaginatedResponse<SupplierSpendRow>;
}
