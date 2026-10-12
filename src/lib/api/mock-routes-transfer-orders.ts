/**
 * Mock routes — lệnh chuyển kho (module 10), khớp BE TransferOrderController (SCRUM-326/327/462).
 * Chỉ dùng khi USE_MOCK=true. PageResponse trang từ 0, lỗi `{ errorCode, message, fieldErrors }`
 * cùng mã + HTTP status như BE; message giữ tiếng Anh như BE — FE tự dịch theo `errorCode`.
 */

import { registerMockRoute } from "./mock-adapter";
import {
  BE_DEFAULT_PAGE_SIZE,
  BE_MAX_PAGE_SIZE,
  MOCK_PO_ACTOR,
  beError,
  beOk,
  bePage,
  isRecord,
  parseJsonBody,
  readInt,
  readParams,
  readRouteId,
  readString,
} from "./mock-routes-purchase-orders-store";
import {
  MOCK_APPROVAL_THRESHOLD,
  MOCK_TRANSFER_TRANSITIONS,
  getTransferStore,
  invalidTransferTransition,
  nextTransferNumber,
  transferNotFound,
} from "./mock-routes-transfer-orders-store";

import type { AxiosRequestConfig } from "axios";
import type {
  MockTransfer,
  MockTransferLine,
  MockTransferStatus,
} from "./mock-routes-transfer-orders-store";

const PATH = "/inventory/transfer-orders";
const ITEM = `${PATH}/:id`;

const toList = (value: unknown): string[] =>
  (Array.isArray(value) ? value : [value]).map(readString).filter(Boolean);

const toRow = (t: MockTransfer) => ({
  transferId: t.transferId,
  number: t.number,
  fromWarehouseId: t.fromWarehouseId,
  toWarehouseId: t.toWarehouseId,
  status: t.status,
  expectedDate: t.expectedDate,
  createdAt: t.createdAt,
  dispatchedAt: t.dispatchedAt,
});

/** BE `CreateTransferOrderRequest` → dòng; lỗi → response 400 như BE. */
function readDraft(body: Record<string, unknown>) {
  const from = readString(body.fromWarehouseId);
  const to = readString(body.toWarehouseId);
  const raw = Array.isArray(body.lines) ? body.lines.filter(isRecord) : [];
  if (!from || !to || raw.length === 0) {
    return {
      ok: false as const,
      error: beError(
        400,
        "VALIDATION_FAILED",
        "A transfer order needs both warehouses and at least one line",
      ),
    };
  }
  // BR-01 (docs 10 §6)
  if (from === to) {
    return {
      ok: false as const,
      error: beError(
        400,
        "VALIDATION_FAILED",
        "Source and destination warehouse must differ; within one warehouse, move the stock instead",
      ),
    };
  }
  const seen = new Set<string>();
  const lines: MockTransferLine[] = [];
  for (const [index, line] of raw.entries()) {
    // = BE: `Sku` in hoa SKU, lô chỉ trim (so lô phân biệt hoa thường)
    const sku = readString(line.sku).toUpperCase();
    const lotNumber = readString(line.lotNumber) || null;
    const key = `${sku}|${lotNumber ?? ""}`;
    if (seen.has(key))
      return {
        ok: false as const,
        error: beError(400, "VALIDATION_FAILED", `Duplicate line for ${sku}`),
      };
    seen.add(key);
    lines.push({
      lineId: crypto.randomUUID(),
      lineNo: index + 1,
      sku,
      lotNumber,
      requested: readInt(line.quantity, 1),
      shipped: 0,
    });
  }
  return {
    ok: true as const,
    draft: {
      fromWarehouseId: from,
      toWarehouseId: to,
      reason: readString(body.reason) || null,
      expectedDate: readString(body.expectedDate) || null,
      lines,
    },
  };
}

/** = BE `activePrefixOf`: chỉ chuyển giữa hai kho đang hoạt động (409 WAREHOUSE_INACTIVE). */
async function inactiveWarehouseError(draft: { fromWarehouseId: string; toWarehouseId: string }) {
  const { warehouses } = await import("@/lib/mock-data");
  for (const id of [draft.fromWarehouseId, draft.toWarehouseId]) {
    const warehouse = warehouses.find((w) => w.warehouseId === id);
    if (!warehouse) return beError(404, "WAREHOUSE_NOT_FOUND", `No warehouse ${id}`);
    if (!warehouse.active) {
      return beError(409, "WAREHOUSE_INACTIVE", `Warehouse ${warehouse.code} is not active`);
    }
  }
  return null;
}

/**
 * Giả lập thiếu tồn để demo lỗi theo dòng: mock không có số tồn thật, coi mỗi dòng (SKU + lô) chỉ
 * có `MOCK_AVAILABLE_PER_LINE` đơn vị. Trả đúng message BE (InsufficientStockException) + fieldErrors
 * theo dòng như CONTRACT ĐỀ XUẤT (code bỏ trống để BE giữ nguyên message có số).
 */
const MOCK_AVAILABLE_PER_LINE = 500;

function insufficientStock(
  rows: readonly { sku: string; quantity: number }[],
  field: "quantity" | "shippedQuantity",
) {
  const short = rows
    .map((row, index) => ({ ...row, index }))
    .filter((row) => row.quantity > MOCK_AVAILABLE_PER_LINE);
  const first = short[0];
  if (!first) return null;
  return beError(
    409,
    "INSUFFICIENT_STOCK",
    `Insufficient stock for SKU ${first.sku}: requested ${first.quantity}, available ${MOCK_AVAILABLE_PER_LINE}`,
    short.map((row) => ({
      field: `lines[${row.index}].${field}`,
      message: `requested ${row.quantity}, available ${MOCK_AVAILABLE_PER_LINE}`,
    })),
  );
}

type Handler = (
  t: MockTransfer,
  body: Record<string, unknown>,
) => MockTransfer | ReturnType<typeof beError>;

/** POST `/{id}/<verb>`: tìm lệnh, kiểm bảng chuyển trạng thái, áp thay đổi. */
/**
 * = BE TransferOrder#requireStatus: mỗi thao tác chỉ chạy từ đúng trạng thái này. Bảng chuyển trạng
 * thái thôi chưa đủ — vd PICKING → APPROVED hợp lệ trong bảng nhưng `/approval` trên lệnh PICKING bị BE
 * từ chối (chỉ `/picking-cancellation` mới đi đường đó).
 */
const REQUIRED_FROM: Record<string, readonly MockTransferStatus[]> = {
  submission: ["DRAFT"],
  approval: ["PENDING_APPROVAL"],
  rejection: ["PENDING_APPROVAL"],
  picking: ["APPROVED"],
  "picking-cancellation": ["PICKING"],
  dispatch: ["PICKING"],
  cancellation: ["DRAFT", "APPROVED"],
};

function transition(
  verb: string,
  target: (t: MockTransfer) => MockTransferStatus,
  apply: Handler,
  /** = `@Valid` body của BE: chạy TRƯỚC khi tải lệnh / kiểm trạng thái (400 trước 404 / 409). */
  validateBody?: (body: Record<string, unknown>) => ReturnType<typeof beError> | null,
) {
  registerMockRoute("POST", `${ITEM}/${verb}`, async (config: AxiosRequestConfig) => {
    const invalid = validateBody?.(parseJsonBody(config.data));
    if (invalid) return invalid;
    const store = await getTransferStore();
    const id = readRouteId(config);
    const current = store.get(id);
    if (!current) return transferNotFound(id);
    const next = target(current);
    const allowedFrom = REQUIRED_FROM[verb] ?? [];
    if (
      !allowedFrom.includes(current.status) ||
      !MOCK_TRANSFER_TRANSITIONS[current.status].includes(next)
    ) {
      return invalidTransferTransition(current.status, next);
    }
    const result = apply(current, parseJsonBody(config.data));
    if (!("transferId" in result)) return result;
    const saved = { ...result, status: next, version: current.version + 1 };
    store.set(id, saved);
    return beOk(saved);
  });
}

const requireReason = (body: Record<string, unknown>) =>
  readString(body.reason) ? null : beError(400, "VALIDATION_FAILED", "reason is required");

export function registerTransferOrderMockRoutes(): void {
  registerMockRoute("GET", PATH, async (config) => {
    const params = readParams(config);
    const statuses = toList(params.status);
    const from = readString(params.fromWarehouseId);
    const to = readString(params.toWarehouseId);
    const search = readString(params.search).toUpperCase();
    const items = [...(await getTransferStore()).values()]
      .filter((t) => statuses.length === 0 || statuses.includes(t.status))
      .filter((t) => (!from || t.fromWarehouseId === from) && (!to || t.toWarehouseId === to))
      .filter((t) => !search || t.number.toUpperCase().includes(search))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(toRow);
    const size = Math.min(BE_MAX_PAGE_SIZE, readInt(params.size, BE_DEFAULT_PAGE_SIZE));
    return beOk(bePage(items, readInt(params.page, 0), size));
  });

  registerMockRoute("GET", ITEM, async (config) => {
    const id = readRouteId(config);
    const transfer = (await getTransferStore()).get(id);
    return transfer ? beOk(transfer) : transferNotFound(id);
  });

  registerMockRoute("POST", PATH, async (config) => {
    const parsed = readDraft(parseJsonBody(config.data));
    if (!parsed.ok) return parsed.error;
    const inactive = await inactiveWarehouseError(parsed.draft);
    if (inactive) return inactive;
    const short = insufficientStock(
      parsed.draft.lines.map((l) => ({ sku: l.sku, quantity: l.requested })),
      "quantity",
    );
    if (short) return short;
    const transfer: MockTransfer = {
      ...parsed.draft,
      transferId: crypto.randomUUID(),
      number: nextTransferNumber(),
      status: "DRAFT",
      submittedBy: null,
      submittedAt: null,
      approvedBy: null,
      approvedAt: null,
      dispatchedBy: null,
      dispatchedAt: null,
      cancelReason: null,
      createdAt: new Date().toISOString(),
      version: 0,
    };
    (await getTransferStore()).set(transfer.transferId, transfer);
    return beOk(transfer, 201);
  });

  registerMockRoute("PUT", ITEM, async (config) => {
    const store = await getTransferStore();
    const id = readRouteId(config);
    const current = store.get(id);
    if (!current) return transferNotFound(id);
    if (current.status !== "DRAFT") {
      return beError(
        409,
        "TRANSFER_ORDER_NOT_EDITABLE",
        `Transfer ${current.number} is ${current.status}`,
      );
    }
    const body = parseJsonBody(config.data);
    // = BE UpdateTransferOrderRequest `version` @NotNull → thiếu là 400, không phải xung đột
    if (body.version === undefined || body.version === null) {
      return beError(400, "VALIDATION_FAILED", "version is required");
    }
    if (readInt(body.version, -1) !== current.version) {
      return beError(409, "OPTIMISTIC_LOCK", "The transfer changed since you read it");
    }
    const parsed = readDraft(body);
    if (!parsed.ok) return parsed.error;
    const inactive = await inactiveWarehouseError(parsed.draft);
    if (inactive) return inactive;
    const short = insufficientStock(
      parsed.draft.lines.map((l) => ({ sku: l.sku, quantity: l.requested })),
      "quantity",
    );
    if (short) return short;
    const saved = { ...current, ...parsed.draft, version: current.version + 1 };
    store.set(id, saved);
    return beOk(saved);
  });

  const now = () => new Date().toISOString();
  const total = (t: MockTransfer) => t.lines.reduce((sum, l) => sum + l.requested, 0);

  // docs 10 §4 bước 3 + §5 "Draft → Approved: Submit (dưới ngưỡng)": tổng SL ≤ ngưỡng → duyệt luôn
  transition(
    "submission",
    (t) => (total(t) <= MOCK_APPROVAL_THRESHOLD ? "APPROVED" : "PENDING_APPROVAL"),
    // = BE TransferOrder#submit: duyệt luôn thì người gửi thành người duyệt, submittedBy/At = null
    (t) =>
      total(t) <= MOCK_APPROVAL_THRESHOLD
        ? {
            ...t,
            submittedBy: null,
            submittedAt: null,
            approvedBy: MOCK_PO_ACTOR,
            approvedAt: now(),
          }
        : { ...t, submittedBy: MOCK_PO_ACTOR, submittedAt: now() },
  );
  transition(
    "approval",
    () => "APPROVED",
    (t) => ({ ...t, approvedBy: MOCK_PO_ACTOR, approvedAt: now() }),
  );
  transition(
    "rejection",
    () => "DRAFT",
    (t) => ({ ...t, submittedBy: null, submittedAt: null }),
    requireReason,
  );
  transition(
    "picking",
    () => "PICKING",
    (t) => t,
  );
  transition(
    "picking-cancellation",
    () => "APPROVED",
    (t) => t,
  );
  transition(
    "cancellation",
    () => "CANCELLED",
    (t, body) => ({ ...t, cancelReason: readString(body.reason) }),
    requireReason,
  );
  transition(
    "dispatch",
    () => "IN_TRANSIT",
    (t, body) => {
      const shipped = new Map<string, number>();
      for (const line of Array.isArray(body.lines) ? body.lines.filter(isRecord) : []) {
        // = BE controller: lineId lặp thì cộng dồn (`merge(…, Integer::sum)`)
        const lineId = readString(line.lineId);
        shipped.set(lineId, (shipped.get(lineId) ?? 0) + readInt(line.shippedQuantity, 0));
      }
      const lines = t.lines.map((line) => ({ ...line, shipped: shipped.get(line.lineId) ?? 0 }));
      if ([...shipped.keys()].some((id) => !t.lines.some((l) => l.lineId === id))) {
        return beError(400, "VALIDATION_FAILED", "A dispatched line is not on this transfer");
      }
      if (lines.some((l) => l.shipped < 0 || l.shipped > l.requested)) {
        return beError(
          400,
          "VALIDATION_FAILED",
          "Shipped quantity must be between 0 and the requested quantity",
        );
      }
      if (lines.every((l) => l.shipped === 0)) {
        return beError(400, "VALIDATION_FAILED", "Ship at least one unit");
      }
      const short = insufficientStock(
        lines.map((l) => ({ sku: l.sku, quantity: l.shipped })),
        "shippedQuantity",
      );
      if (short) return short;
      return { ...t, lines, dispatchedBy: MOCK_PO_ACTOR, dispatchedAt: now() };
    },
  );
}
