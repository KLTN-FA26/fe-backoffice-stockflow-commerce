/**
 * Mock routes — Đơn đặt hàng NCC (module 02), tách khỏi `mock-routes.ts` giống
 * `mock-routes-suppliers.ts` để PR PO không sửa chung đoạn code với PR khác.
 *
 * Trả đúng hợp đồng BE `PurchaseOrderController` (nhánh BE `test`), nên
 * `features/purchase-order/api.ts` chỉ có MỘT luồng xử lý cho cả mock lẫn BE thật.
 * Gửi NCC / khôi phục / NCC xác nhận / lịch sử gửi: `mock-routes-purchase-orders-delivery.ts`.
 */

import { registerMockRoute } from "./mock-adapter";
import { registerPoDeliveryMockRoutes } from "./mock-routes-purchase-orders-delivery";
import {
  BE_DEFAULT_PAGE_SIZE,
  BE_GENERIC_VALIDATION_MESSAGE,
  BE_MAX_PAGE_SIZE,
  BE_PO_STATUSES,
  BE_PO_TRANSITIONS,
  MOCK_PO_ACTOR,
  beError,
  beOk,
  bePage,
  getPoStore,
  invalidTransition,
  isRecord,
  notFound,
  parseJsonBody,
  readInt,
  readParams,
  readRouteId,
  readString,
  sumLines,
  touch,
} from "./mock-routes-purchase-orders-store";
import { findMockSupplier } from "./mock-routes-suppliers";

import type { AxiosRequestConfig } from "axios";
import type {
  BePoStatus,
  MockBePo,
  MockBePoLine,
  MockFieldError,
} from "./mock-routes-purchase-orders-store";

/** BE `ProcurementServiceImpl.SORT` whitelist. */
const PO_SORT_WHITELIST = ["poNumber", "expectedAt", "createdAt", "lastModifiedAt", "status"];
/** BE `common.domain.Sku` — mã được trim + upper-case rồi phải khớp mẫu này. */
const BE_SKU_PATTERN = /^[A-Z0-9-]{3,64}$/;
const poNumberSequence = new Map<string, number>();

type SortOrder = { prop: keyof MockBePo; desc: boolean }[];

function isBePoStatus(value: string): value is BePoStatus {
  return (BE_PO_STATUSES as readonly string[]).includes(value);
}

function isSortProp(value: string): value is keyof MockBePo {
  return PO_SORT_WHITELIST.includes(value);
}

function toArray(value: unknown): unknown[] {
  if (value == null || value === "") return [];
  return Array.isArray(value) ? value : [value];
}

/** BE `SortWhitelist#parse` — "prop,dir;prop2,dir2"; null khi có prop ngoài whitelist. */
function parseSort(raw: string): SortOrder | null {
  const order: SortOrder = [];
  for (const clause of raw
    .split(";")
    .map((c) => c.trim())
    .filter(Boolean)) {
    const [prop = "", dir = ""] = clause.split(",").map((s) => s.trim());
    if (!isSortProp(prop)) return null;
    order.push({ prop, desc: dir.toLowerCase() === "desc" });
  }
  return order.length ? order : [{ prop: "lastModifiedAt", desc: true }];
}

function comparePo(a: MockBePo, b: MockBePo, order: SortOrder): number {
  for (const { prop, desc } of order) {
    const cmp = String(a[prop] ?? "").localeCompare(String(b[prop] ?? ""));
    if (cmp !== 0) return desc ? -cmp : cmp;
  }
  return 0;
}

function nextPoNumber(): string {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const seq = (poNumberSequence.get(ymd) ?? 0) + 1;
  poNumberSequence.set(ymd, seq);
  return `PO-${ymd}-${String(seq).padStart(6, "0")}`;
}

/** BE `CreatePurchaseOrderRequest` + `CreatePOLineRequest` bean validation. */
function readCreateLines(rawLines: unknown[], fieldErrors: MockFieldError[]): MockBePoLine[] {
  return rawLines.map((raw, idx) => {
    const r = isRecord(raw) ? raw : {};
    const sku = readString(r.sku).toUpperCase();
    const qty = r.quantityOrdered;
    const price = r.unitPrice;
    if (!BE_SKU_PATTERN.test(sku)) {
      fieldErrors.push({ field: `lines[${idx}].sku`, message: "sku is required" });
    }
    if (typeof qty !== "number" || !Number.isInteger(qty) || qty <= 0) {
      fieldErrors.push({
        field: `lines[${idx}].quantityOrdered`,
        message: "quantityOrdered must be positive",
      });
    }
    if (typeof price !== "number" || !Number.isFinite(price) || price < 0) {
      fieldErrors.push({
        field: `lines[${idx}].unitPrice`,
        message: "unitPrice must not be negative",
      });
    }
    const quantityOrdered = typeof qty === "number" ? qty : 0;
    return {
      lineId: crypto.randomUUID(),
      sku,
      description: readString(r.description) || null,
      quantityOrdered,
      quantityReceived: 0,
      openQuantity: quantityOrdered,
      unitPrice: typeof price === "number" ? price : 0,
    };
  });
}

async function createPurchaseOrder(config: AxiosRequestConfig) {
  const body = parseJsonBody(config.data);
  const supplierId = readString(body.supplierId);
  const currency = readString(body.currency) || "VND";
  const expectedAt = readString(body.expectedAt) || null;
  const rawLines: unknown[] = Array.isArray(body.lines) ? body.lines : [];
  const fieldErrors: MockFieldError[] = [];
  if (!supplierId) fieldErrors.push({ field: "supplierId", message: "supplierId is required" });
  if (!/^[A-Z]{3}$/.test(currency)) {
    fieldErrors.push({ field: "currency", message: "currency must be a 3-letter ISO code" });
  }
  if (rawLines.length === 0) {
    fieldErrors.push({ field: "lines", message: "at least one line is required" });
  }
  const lines = readCreateLines(rawLines, fieldErrors);
  if (fieldErrors.length > 0) {
    return beError(400, "VALIDATION_FAILED", BE_GENERIC_VALIDATION_MESSAGE, fieldErrors);
  }
  const supplier = await findMockSupplier(supplierId);
  if (!supplier) return beError(404, "SUPPLIER_NOT_FOUND", `No supplier with id ${supplierId}`);
  if (supplier.status !== "ACTIVE") {
    return beError(409, "SUPPLIER_INACTIVE", `Supplier ${supplierId} is INACTIVE`);
  }
  const store = await getPoStore();
  // BR-PO-003 (BE isPossibleDuplicate): PO chưa đóng, cùng NCC + ngày giao + ≥1 SKU trùng → cảnh báo.
  const skuSet = new Set(lines.map((l) => l.sku));
  const possibleDuplicate =
    expectedAt !== null &&
    [...store.values()].some(
      (po) =>
        po.supplierId === supplierId &&
        po.expectedAt === expectedAt &&
        !["CANCELLED", "CLOSED", "CLOSED_SHORT"].includes(po.status) &&
        po.lines.some((l) => skuSet.has(l.sku)),
    );
  const now = new Date().toISOString();
  const po: MockBePo = {
    purchaseOrderId: crypto.randomUUID(),
    poNumber: nextPoNumber(),
    supplierId,
    status: "DRAFT",
    currency,
    totalAmount: sumLines(lines),
    expectedAt,
    lines,
    createdAt: now,
    createdBy: MOCK_PO_ACTOR,
    lastModifiedAt: now,
    lastModifiedBy: MOCK_PO_ACTOR,
    possibleDuplicate: false,
    cancellationReason: null,
    closeShortReason: null,
    paymentTermDays: supplier.paymentTermDays,
    leadTimeDays: supplier.leadTimeDays,
    sentAt: null,
    supplierConfirmationStatus: "NOT_SENT",
    supplierRespondedAt: null,
    supplierReference: null,
    supplierResponseNote: null,
    deliveryStatus: "NOT_SENT",
    cancellationDeliveryStatus: "NOT_REQUIRED",
    warnings: [],
  };
  store.set(po.purchaseOrderId, po);
  return beOk({ ...po, possibleDuplicate }, 201);
}

/** Chuyển trạng thái một bước (approval / cancellation / closure-short). */
const transition =
  (target: BePoStatus, reasonField?: "cancellationReason" | "closeShortReason") =>
  async (config: AxiosRequestConfig) => {
    const id = readRouteId(config);
    const store = await getPoStore();
    const po = store.get(id);
    if (!po) return notFound(id);
    const reason = readString(parseJsonBody(config.data).reason);
    if (reasonField && !reason) {
      return beError(400, "VALIDATION_FAILED", BE_GENERIC_VALIDATION_MESSAGE, [
        { field: "reason", message: "reason is required" },
      ]);
    }
    if (!BE_PO_TRANSITIONS[po.status].includes(target)) {
      return invalidTransition(`Purchase order ${id} cannot move from ${po.status} to ${target}`);
    }
    const patch: Partial<MockBePo> = { status: target };
    if (reasonField) patch[reasonField] = reason;
    // BE #36: huỷ PO đã gửi NCC → xếp hàng gửi thông báo huỷ cho NCC.
    if (target === "CANCELLED" && po.sentAt) patch.cancellationDeliveryStatus = "QUEUED";
    const updated = touch(po, patch);
    store.set(id, updated);
    return beOk(updated);
  };

/** BE `PurchaseOrder#receiveGoods` + `PoLine#receive`. */
async function receiveGoods(config: AxiosRequestConfig) {
  const id = readRouteId(config);
  const store = await getPoStore();
  const po = store.get(id);
  if (!po) return notFound(id);
  const body = parseJsonBody(config.data);
  const requested: unknown[] = Array.isArray(body.lines) ? body.lines : [];
  if (requested.length === 0) {
    return beError(400, "VALIDATION_FAILED", BE_GENERIC_VALIDATION_MESSAGE, [
      { field: "lines", message: "at least one line is required" },
    ]);
  }
  if (po.status !== "SENT" && po.status !== "PARTIALLY_RECEIVED") {
    return invalidTransition(`cannot receive goods while ${po.status}`);
  }
  if (po.supplierConfirmationStatus === "REJECTED") {
    return invalidTransition(
      "Cannot receive a rejected purchase order; cancel it and create a replacement",
    );
  }
  const received = new Map<string, number>();
  for (const raw of requested) {
    const r = isRecord(raw) ? raw : {};
    const line = po.lines.find((l) => l.lineId === readString(r.lineId));
    const qty = r.quantity;
    // BE: dòng lạ / qty ≤ 0 / qty > openQuantity là IllegalArgumentException → 400 chung.
    if (
      !line ||
      typeof qty !== "number" ||
      !Number.isInteger(qty) ||
      qty <= 0 ||
      qty > line.openQuantity
    ) {
      return beError(400, "VALIDATION_FAILED", BE_GENERIC_VALIDATION_MESSAGE);
    }
    received.set(line.lineId, qty);
  }
  const lines = po.lines.map((l) => {
    const qty = received.get(l.lineId) ?? 0;
    return { ...l, quantityReceived: l.quantityReceived + qty, openQuantity: l.openQuantity - qty };
  });
  const status: BePoStatus = lines.every((l) => l.openQuantity === 0)
    ? "CLOSED"
    : "PARTIALLY_RECEIVED";
  const updated = touch(po, { lines, status });
  store.set(id, updated);
  return beOk(updated);
}

/** GET /reports/supplier-spend — BE #40: một dòng cho mỗi cặp NCC + tiền tệ. */
async function supplierSpend(config: AxiosRequestConfig) {
  const p = readParams(config);
  const page = readInt(p.page, 0);
  const size = readInt(p.size, BE_DEFAULT_PAGE_SIZE);
  const supplierFilter = readString(p.supplierId);
  const currencyFilter = readString(p.currency).toUpperCase();
  const from = readString(p.expectedAtFrom);
  const to = readString(p.expectedAtTo);
  const groups = new Map<
    string,
    { supplierId: string; currency: string; total: number; count: number }
  >();
  for (const po of (await getPoStore()).values()) {
    if (po.status === "DRAFT" || po.status === "CANCELLED") continue;
    if (supplierFilter && po.supplierId !== supplierFilter) continue;
    if (currencyFilter && po.currency !== currencyFilter) continue;
    if (from && (po.expectedAt ?? "") < from) continue;
    if (to && (po.expectedAt ?? "") > to) continue;
    const key = `${po.supplierId}|${po.currency}`;
    const cur = groups.get(key) ?? {
      supplierId: po.supplierId,
      currency: po.currency,
      total: 0,
      count: 0,
    };
    groups.set(key, { ...cur, total: cur.total + po.totalAmount, count: cur.count + 1 });
  }
  const rows = await Promise.all(
    [...groups.values()].map(async (g) => {
      const supplier = await findMockSupplier(g.supplierId);
      return {
        supplierId: g.supplierId,
        supplierCode: supplier?.code ?? g.supplierId,
        supplierName: supplier?.name ?? g.supplierId,
        currency: g.currency,
        totalSpend: g.total,
        purchaseOrderCount: g.count,
      };
    }),
  );
  rows.sort(
    (a, b) =>
      a.currency.localeCompare(b.currency) ||
      b.totalSpend - a.totalSpend ||
      a.supplierId.localeCompare(b.supplierId),
  );
  return beOk(bePage(rows, page, size));
}

export function registerPurchaseOrderMockRoutes(): void {
  // GET /purchase-orders — BE: page (0-based), size, supplierId, status (lặp lại), sort. Không có search.
  registerMockRoute("GET", "/purchase-orders", async (config) => {
    const p = readParams(config);
    const page = readInt(p.page, 0);
    const size = readInt(p.size, BE_DEFAULT_PAGE_SIZE);
    if (page < 0 || size < 1 || size > BE_MAX_PAGE_SIZE) {
      return beError(400, "VALIDATION_FAILED", `Page size must not exceed ${BE_MAX_PAGE_SIZE}`);
    }
    const statuses = toArray(p.status).map(String);
    if (statuses.some((s) => !isBePoStatus(s))) {
      return beError(400, "VALIDATION_FAILED", BE_GENERIC_VALIDATION_MESSAGE);
    }
    const order = parseSort(readString(p.sort));
    if (!order) {
      return beError(400, "UNSUPPORTED_PARAMETER", `Allowed: ${PO_SORT_WHITELIST.join(", ")}`);
    }
    const supplierId = readString(p.supplierId);
    const rows = [...(await getPoStore()).values()]
      .filter((po) => !supplierId || po.supplierId === supplierId)
      .filter((po) => statuses.length === 0 || statuses.includes(po.status))
      .sort((a, b) => comparePo(a, b, order))
      .map((po) => ({ ...po, lines: [] })); // BE: list row không có lines
    return beOk(bePage(rows, page, size));
  });

  registerMockRoute("GET", "/purchase-orders/:id", async (config) => {
    const id = readRouteId(config);
    const po = (await getPoStore()).get(id);
    return po ? beOk(po) : notFound(id);
  });

  registerMockRoute("GET", "/purchase-orders/reports/status-dashboard", async () => {
    const all = [...(await getPoStore()).values()];
    return beOk(
      BE_PO_STATUSES.map((status) => ({
        status,
        count: all.filter((po) => po.status === status).length,
      })),
    );
  });

  registerMockRoute("GET", "/purchase-orders/reports/supplier-spend", supplierSpend);
  registerMockRoute("POST", "/purchase-orders", createPurchaseOrder);
  registerMockRoute("POST", "/purchase-orders/:id/approval", transition("APPROVED"));
  registerMockRoute(
    "POST",
    "/purchase-orders/:id/cancellation",
    transition("CANCELLED", "cancellationReason"),
  );
  registerMockRoute(
    "POST",
    "/purchase-orders/:id/closure-short",
    transition("CLOSED_SHORT", "closeShortReason"),
  );
  registerMockRoute("POST", "/purchase-orders/:id/receipts", receiveGoods);
  registerPoDeliveryMockRoutes();
}
