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
  MOCK_APPROVER,
  MOCK_PO_ACTOR,
  MOCK_WAREHOUSE,
  beError,
  beOk,
  bePage,
  getDeliveries,
  getPoStore,
  invalidTransition,
  isRecord,
  notFound,
  parseJsonBody,
  queueOutbox,
  readInt,
  readParams,
  readRouteId,
  readString,
  sumLines,
  sumTax,
  suppressQueuedDelivery,
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
const BE_SKU_PATTERN = /^[A-Z0-9][A-Z0-9._-]{0,63}$/;
const poNumberSequence = new Map<string, number>();
/** PO đã từng có revision (gửi duyệt) — lần gửi lại sau khi bị từ chối là revision kế tiếp. */
const revisedPos = new Set<string>();

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
    const tax = r.taxRate ?? 0;
    if (!BE_SKU_PATTERN.test(sku)) {
      fieldErrors.push({ field: `lines[${idx}].sku`, message: "sku is required" });
    }
    if (typeof qty !== "number" || !Number.isInteger(qty) || qty <= 0) {
      fieldErrors.push({
        field: `lines[${idx}].quantityOrdered`,
        message: "quantityOrdered must be positive",
      });
    }
    if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
      fieldErrors.push({
        field: `lines[${idx}].unitPrice`,
        message: "unitPrice must be positive",
      });
    }
    if (typeof tax !== "number" || tax < 0 || tax > 100) {
      fieldErrors.push({ field: `lines[${idx}].taxRate`, message: "taxRate must be 0..100" });
    }
    const description = readString(r.description) || null;
    if (description && description.length > 255) {
      fieldErrors.push({ field: `lines[${idx}].description`, message: "size must be ≤ 255" });
    }
    const quantityOrdered = typeof qty === "number" ? qty : 0;
    const unitPrice = typeof price === "number" ? price : 0;
    const taxRate = typeof tax === "number" ? tax : 0;
    return {
      lineId: crypto.randomUUID(),
      lineNo: idx + 1,
      inventoryItemId: `item-${sku}`,
      sku,
      description,
      uom: "EACH",
      quantityOrdered,
      quantityReceived: 0,
      openQuantity: quantityOrdered,
      unitPrice,
      taxRate,
      lineTotal: quantityOrdered * unitPrice,
      status: "OPEN" as const,
    };
  });
}

async function createPurchaseOrder(config: AxiosRequestConfig) {
  const body = parseJsonBody(config.data);
  const supplierId = readString(body.supplierId);
  const warehouseId = readString(body.warehouseId);
  const currency = readString(body.currency) || "VND";
  const expectedAt = readString(body.expectedAt) || null;
  const note = readString(body.note) || null;
  const rawLines: unknown[] = Array.isArray(body.lines) ? body.lines : [];
  const fieldErrors: MockFieldError[] = [];
  if (!supplierId) fieldErrors.push({ field: "supplierId", message: "supplierId is required" });
  if (!warehouseId) fieldErrors.push({ field: "warehouseId", message: "warehouseId is required" });
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
    return beError(409, "SUPPLIER_INACTIVE", `Supplier ${supplierId} is ${supplier.status}`);
  }
  if (warehouseId !== MOCK_WAREHOUSE.id) {
    return beError(404, "WAREHOUSE_NOT_FOUND", `No warehouse with id ${warehouseId}`);
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
        !["CANCELLED", "CLOSED"].includes(po.status) &&
        po.lines.some((l) => skuSet.has(l.sku)),
    );
  const now = new Date().toISOString();
  const subtotal = sumLines(lines);
  const taxTotal = sumTax(lines);
  const po: MockBePo = {
    purchaseOrderId: crypto.randomUUID(),
    poNumber: nextPoNumber(),
    type: "STANDARD",
    productionOrderId: null,
    supplierId,
    supplierCode: supplier.code,
    supplierName: supplier.name,
    warehouseId,
    warehouseCode: MOCK_WAREHOUSE.prefix,
    warehouseName: MOCK_WAREHOUSE.name,
    status: "DRAFT",
    currency,
    orderDate: now.slice(0, 10),
    subtotal,
    taxTotal,
    totalAmount: subtotal + taxTotal,
    note,
    expectedAt,
    lines,
    createdAt: now,
    createdBy: MOCK_PO_ACTOR,
    lastModifiedAt: now,
    lastModifiedBy: MOCK_PO_ACTOR,
    possibleDuplicate: false,
    revisionNo: 0,
    submittedBy: null,
    submittedAt: null,
    approvedBy: null,
    approvedAt: null,
    confirmedBy: null,
    confirmedAt: null,
    closedAt: null,
    closeKind: null,
    closeReason: null,
    cancellationReason: null,
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

function queueCancellationNotice(poId: string): void {
  const previous = getDeliveries(poId)[0];
  queueOutbox(poId, {
    channel: previous?.channel ?? "EMAIL",
    recipient: previous?.recipient ?? "",
    generation: 0,
    templateCode: "purchase-order.cancelled",
  });
}

type PoTransition = {
  target: BePoStatus;
  /** Trạng thái nguồn bắt buộc khi khác bảng chuyển chung (closure-short / closure). */
  from?: BePoStatus;
  reasonMax?: number;
  /** Kiểm tra nghiệp vụ trước khi đổi (vd. BR-PO-002); trả lỗi BE nếu vi phạm. */
  guard?: (po: MockBePo) => ReturnType<typeof beError> | null;
  patch: (po: MockBePo, reason: string, now: string) => Partial<MockBePo>;
};

/** Một bước chuyển trạng thái — mirror các method của BE `PurchaseOrder` (D4). */
const transition =
  ({ target, from, reasonMax, guard, patch }: PoTransition) =>
  async (config: AxiosRequestConfig) => {
    const id = readRouteId(config);
    const store = await getPoStore();
    const po = store.get(id);
    if (!po) return notFound(id);
    const reason = readString(parseJsonBody(config.data).reason);
    if (reasonMax !== undefined && (!reason || reason.length > reasonMax)) {
      return beError(400, "VALIDATION_FAILED", BE_GENERIC_VALIDATION_MESSAGE, [
        { field: "reason", message: reason ? `size must be ≤ ${reasonMax}` : "reason is required" },
      ]);
    }
    const allowed = from ? po.status === from : BE_PO_TRANSITIONS[po.status].includes(target);
    if (!allowed) {
      return invalidTransition(`Purchase order ${id} cannot move from ${po.status} to ${target}`);
    }
    const violation = guard?.(po);
    if (violation) return violation;
    const updated = touch(po, { ...patch(po, reason, new Date().toISOString()), status: target });
    store.set(id, updated);
    if (target === "CANCELLED" && updated.cancellationDeliveryStatus === "QUEUED") {
      queueCancellationNotice(id);
    }
    return beOk(updated);
  };

const settleLines = (po: MockBePo, status: MockBePoLine["status"]): MockBePoLine[] =>
  po.lines.map((l) =>
    l.status === "OPEN" || l.status === "PARTIALLY_RECEIVED" ? { ...l, status } : l,
  );

/** BE `submit`: DRAFT → PENDING_APPROVAL; lần gửi lại sau khi bị từ chối là revision kế tiếp. */
const submit = transition({
  target: "PENDING_APPROVAL",
  patch: (po, _reason, now) => {
    const revisionNo = revisedPos.has(po.purchaseOrderId) ? po.revisionNo + 1 : po.revisionNo;
    revisedPos.add(po.purchaseOrderId);
    return { submittedBy: MOCK_PO_ACTOR, submittedAt: now, revisionNo };
  },
});

/**
 * BE `approve`: BR-PO-002 bốn mắt. Mock chỉ có một người dùng nên người duyệt là
 * `MOCK_APPROVER` — khác `MOCK_PO_ACTOR` đã gửi duyệt, giống hai tài khoản trên BE thật.
 */
const approve = transition({
  target: "APPROVED",
  guard: (po) =>
    po.submittedBy === MOCK_APPROVER
      ? beError(
          409,
          "SELF_APPROVAL_NOT_ALLOWED",
          "A purchase order is approved by someone other than who submitted it",
        )
      : null,
  patch: (_po, _reason, now) => ({ approvedBy: MOCK_APPROVER, approvedAt: now }),
});

/** BE `reject`: PENDING_APPROVAL → DRAFT, lý do ≤ 500; người gửi duyệt bị xoá. */
const reject = transition({
  target: "DRAFT",
  from: "PENDING_APPROVAL",
  reasonMax: 500,
  patch: () => ({ submittedBy: null, submittedAt: null }),
});

/** BE `cancel` (lý do ≤ 255): PO đã gửi NCC thì xếp thư báo huỷ tới đúng nơi đã nhận đơn. */
const cancel = transition({
  target: "CANCELLED",
  reasonMax: 255,
  patch: (po, reason) => ({
    cancellationReason: reason,
    lines: settleLines(po, "CANCELLED"),
    // BE cancel → suppressSupplierDelivery: thư gửi đơn còn chờ thì không gửi nữa.
    ...suppressQueuedDelivery(po),
    ...(po.status === "CONFIRMED" ? { cancellationDeliveryStatus: "QUEUED" as const } : {}),
  }),
});

/** BE `closeShort`: PARTIALLY_RECEIVED → CLOSED (SHORT_CLOSE), lý do ≤ 255. */
const closeShort = transition({
  target: "CLOSED",
  from: "PARTIALLY_RECEIVED",
  reasonMax: 255,
  patch: (po, reason, now) => ({
    closeKind: "SHORT_CLOSE",
    closeReason: reason,
    closedAt: now,
    lines: settleLines(po, "CLOSED"),
  }),
});

/** BE `close`: RECEIVED → CLOSED (NORMAL). */
const close = transition({
  target: "CLOSED",
  from: "RECEIVED",
  patch: (po, _reason, now) => ({
    closeKind: "NORMAL",
    closeReason: null,
    closedAt: now,
    lines: settleLines(po, "CLOSED"),
  }),
});

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
  // GET /purchase-orders — BE: page (0-based), size, supplierId, warehouseId, status (lặp lại), q, sort.
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
    const warehouseId = readString(p.warehouseId);
    const q = readString(p.q).toLowerCase();
    const rows = [...(await getPoStore()).values()]
      .filter((po) => !supplierId || po.supplierId === supplierId)
      .filter((po) => !warehouseId || po.warehouseId === warehouseId)
      .filter(
        (po) =>
          !q ||
          po.poNumber.toLowerCase().includes(q) ||
          (po.supplierName ?? "").toLowerCase().includes(q),
      )
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
  registerMockRoute("POST", "/purchase-orders/:id/submission", submit);
  registerMockRoute("POST", "/purchase-orders/:id/approval", approve);
  registerMockRoute("POST", "/purchase-orders/:id/rejection", reject);
  registerMockRoute("POST", "/purchase-orders/:id/cancellation", cancel);
  registerMockRoute("POST", "/purchase-orders/:id/closure-short", closeShort);
  registerMockRoute("POST", "/purchase-orders/:id/closure", close);
  registerPoDeliveryMockRoutes();
}
