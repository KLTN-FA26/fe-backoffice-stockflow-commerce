/**
 * Mock routes — Goods receipt (module 03), khớp BE PR #62 (GoodsReceiptController +
 * GoodsReceiptServiceImpl + GoodsReceipt aggregate). Chỉ dùng khi USE_MOCK=true.
 *
 * Trả đúng hợp đồng: PageResponse trang từ 0, lỗi `{ errorCode, message, fieldErrors[] }`, cùng mã
 * lỗi và HTTP status như BE. Message lỗi giữ tiếng Anh như BE — FE tự dịch theo `errorCode`.
 */

import { registerMockRoute } from "./mock-adapter";
import {
  MOCK_APPROVER_ACTOR,
  MOCK_RECEIPT_ACTOR,
  MOCK_WAREHOUSE_ID,
  MOCK_WAREHOUSE_OPTION,
  getReceiptStore,
  invalidReceiptTransition,
  itemPolicy,
  loadReceipt,
  mockReceivableLimit,
  mockSkuExists,
  nextReceiptNumber,
  overToleranceLines,
  receiptNotFound,
  receivedElsewhere,
  recordPoProgress,
  requireStatus,
  resolveArea,
  saveReceipt,
  withWarnings,
} from "./mock-routes-goods-receipts-store";
import { registerGoodsReceiptQcMockRoutes } from "./mock-routes-goods-receipts-qc";
import { findMockSupplier } from "./mock-routes-suppliers";
import {
  BE_DEFAULT_PAGE_SIZE,
  BE_MAX_PAGE_SIZE,
  beError,
  beOk,
  bePage,
  getPoStore,
  isRecord,
  parseJsonBody,
  readInt,
  readParams,
  readString,
} from "./mock-routes-purchase-orders-store";

import type { MockReceipt, MockReceiptLine } from "./mock-routes-goods-receipts-store";
import type { MockBePo, MockFieldError } from "./mock-routes-purchase-orders-store";

const PATH = "/goods-receipts";
const SORTABLE: Record<string, (r: MockReceipt) => string> = {
  receivedAt: (r) => r.receivedAt,
  receiptNumber: (r) => r.number,
  status: (r) => r.status,
};
// BR-01: chỉ nhận cho PO đã chốt (CONFIRMED, BE PR #71 D4) hoặc đang nhận dở.
const RECEIVABLE_PO = ["CONFIRMED", "PARTIALLY_RECEIVED"];

/* ── Kiểm đếm ────────────────────────────────────────────────────────── */

/** `@Valid ReceiptLinesRequest` → 400 VALIDATION_FAILED kèm fieldErrors `lines[i].field`. */
function validateLinesRequest(body: Record<string, unknown>): MockFieldError[] {
  const errors: MockFieldError[] = [];
  const lines = body.lines;
  if (!Array.isArray(lines) || lines.length === 0)
    return [{ field: "lines", message: "must not be empty", code: "NotEmpty" }];
  if (lines.length > 200)
    errors.push({ field: "lines", message: "size must be between 0 and 200", code: "Size" });
  lines.forEach((raw: unknown, i) => {
    const line = isRecord(raw) ? raw : {};
    if (!readString(line.purchaseOrderLineId))
      errors.push({
        field: `lines[${i}].purchaseOrderLineId`,
        message: "must not be null",
        code: "NotNull",
      });
    if (typeof line.quantity !== "number" || line.quantity <= 0)
      errors.push({
        field: `lines[${i}].quantity`,
        message: "must be greater than 0",
        code: "Positive",
      });
    if (!readString(line.locationCode))
      errors.push({
        field: `lines[${i}].locationCode`,
        message: "must not be blank",
        code: "NotBlank",
      });
  });
  return errors;
}

/**
 * BR-RCP-002: kiểm đếm phiếu không có PO — dòng gọi hàng bằng `sku`; lỗi từng ô như BE (`LineErrors`): thiếu SKU,
 * SKU lạ, đưa dòng PO vào phiếu không có PO, khu sai loại, lô / hạn dùng, cùng SKU + lô hai lần.
 */
async function replaceBlindLines(receipt: MockReceipt, body: Record<string, unknown>) {
  const notDraft = requireStatus(receipt, "DRAFT", "change the lines of");
  const lines = Array.isArray(body.lines) ? body.lines : [];
  if (lines.length === 0)
    return beError(400, "VALIDATION_FAILED", "Invalid request data", [
      { field: "lines", message: "must not be empty", code: "NotEmpty" },
    ]);
  const receivedOn = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(
    new Date(receipt.receivedAt),
  );
  const errors: MockFieldError[] = [];
  const counted: MockReceiptLine[] = [];
  const seen = new Set<string>();
  for (const [i, raw] of lines.entries()) {
    const line = isRecord(raw) ? raw : {};
    const at = (field: string) => `lines[${i}].${field}`;
    if (readString(line.purchaseOrderLineId)) {
      errors.push({
        field: at("purchaseOrderLineId"),
        code: "RECEIPT_LINE_NOT_ON_PO",
        message: `Receipt ${receipt.number} has no purchase order: count the item by its SKU`,
      });
      continue;
    }
    const sku = readString(line.sku).toUpperCase();
    if (!sku) {
      errors.push({ field: at("sku"), code: "VALIDATION_FAILED", message: "The SKU is required" });
      continue;
    }
    if (!(await mockSkuExists(sku))) {
      errors.push({
        field: at("sku"),
        code: "INVENTORY_ITEM_NOT_FOUND",
        message: `No inventory item with SKU ${sku}`,
      });
      continue;
    }
    const policy = await itemPolicy(sku);
    const area = resolveArea(line.locationCode, "RECEIVING");
    if (area.error) {
      errors.push({
        field: at("locationCode"),
        code: "LOCATION_AREA_MISMATCH",
        message: "Not a RECEIVING area of this receipt's warehouse",
      });
      continue;
    }
    const lot = readString(line.lotNumber) || null;
    const expiry = readString(line.expiryDate) || null;
    if (policy.lotTracked && !lot)
      errors.push({
        field: at("lotNumber"),
        code: "LOT_REQUIRED",
        message: `${sku} is lot-tracked (BR-03)`,
      });
    if (!policy.lotTracked && lot)
      errors.push({
        field: at("lotNumber"),
        code: "LOT_NOT_ALLOWED",
        message: `${sku} is not lot-tracked`,
      });
    if (policy.expiryTracked && !expiry)
      errors.push({
        field: at("expiryDate"),
        code: "EXPIRY_REQUIRED",
        message: `${sku} is expiry-tracked (BR-03)`,
      });
    if (!policy.expiryTracked && expiry)
      errors.push({
        field: at("expiryDate"),
        code: "EXPIRY_NOT_ALLOWED",
        message: `${sku} is not expiry-tracked`,
      });
    if (expiry && expiry <= receivedOn)
      errors.push({
        field: at("expiryDate"),
        code: "EXPIRY_NOT_AFTER_RECEIPT",
        message: `Expiry date ${expiry} must be after the receiving date ${receivedOn} (BR-06)`,
      });
    const key = `${sku}|${lot ?? ""}`;
    if (seen.has(key))
      errors.push({
        field: at("lotNumber"),
        code: "DUPLICATE_RECEIPT_LINE",
        message: `${sku} with this lot is already counted above; put the whole quantity of a lot on one line`,
      });
    seen.add(key);
    counted.push({
      id: crypto.randomUUID(),
      purchaseOrderLineId: null,
      purchaseOrderLineNo: null,
      inventoryItemId: policy.inventoryItemId,
      sku,
      quantity: typeof line.quantity === "number" ? line.quantity : 0,
      lotNumber: lot,
      expiryDate: expiry,
      locationCode: area.code ?? "",
      note: readString(line.note) || null,
      qcRequired: policy.qcRequired,
      qcProgress: policy.qcRequired ? "AWAITING_MOVE_TO_QC" : "NOT_REQUIRED",
      qcLocationCode: null,
      movedToQcAt: null,
      quantityForPutaway: policy.qcRequired ? 0 : Number(line.quantity),
      inspections: [],
    });
  }
  if (errors.length) {
    const first = errors[0];
    return beError(
      409,
      first?.code === "VALIDATION_FAILED"
        ? "VALIDATION_FAILED"
        : (first?.code ?? "VALIDATION_FAILED"),
      `Receipt line: ${first?.message ?? "invalid"}`,
      errors,
    );
  }
  if (notDraft) return notDraft;
  return saveReceipt({ ...receipt, lines: counted });
}

async function replaceLines(receipt: MockReceipt, body: Record<string, unknown>) {
  if (receipt.withoutPurchaseOrder) return replaceBlindLines(receipt, body);
  const notDraft = requireStatus(receipt, "DRAFT", "change the lines of");
  const fieldErrors = validateLinesRequest(body);
  if (fieldErrors.length)
    return beError(400, "VALIDATION_FAILED", "Invalid request data", fieldErrors);
  const po = receipt.purchaseOrderId
    ? (await getPoStore()).get(receipt.purchaseOrderId)
    : undefined;
  if (!po)
    return beError(404, "PURCHASE_ORDER_NOT_FOUND", `No purchase order ${receipt.purchaseOrderId}`);
  const receivedOn = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(
    new Date(receipt.receivedAt),
  );

  const counted: MockReceiptLine[] = [];
  for (const raw of body.lines as unknown[]) {
    const line = isRecord(raw) ? raw : {};
    const poLineId = readString(line.purchaseOrderLineId);
    const index = po.lines.findIndex((l) => l.lineId === poLineId);
    const poLine = po.lines[index];
    if (!poLine)
      return beError(400, "VALIDATION_FAILED", `Line ${poLineId} is not a line of ${po.poNumber}`);
    if (poLine.openQuantity === 0 && poLine.quantityReceived >= poLine.quantityOrdered) {
      return beError(
        409,
        "PURCHASE_ORDER_NOT_RECEIVABLE",
        `Line ${index + 1} of ${po.poNumber} is RECEIVED`,
      );
    }
    const policy = await itemPolicy(poLine.sku);
    const area = resolveArea(line.locationCode, "RECEIVING");
    if (area.error) return area.error;
    const lot = readString(line.lotNumber) || null;
    const expiry = readString(line.expiryDate) || null;
    // BR-03 / BR-06 — BE `checkLotData`
    const lotError =
      (policy.lotTracked &&
        !lot &&
        `${poLine.sku} is lot-tracked: each line needs a lot number (BR-03)`) ||
      (!policy.lotTracked &&
        lot &&
        `${poLine.sku} is not lot-tracked; leave the lot number empty`) ||
      (policy.expiryTracked &&
        !expiry &&
        `${poLine.sku} is expiry-tracked: each line needs an expiry date (BR-03)`) ||
      (!policy.expiryTracked &&
        expiry &&
        `${poLine.sku} is not expiry-tracked; leave the expiry date empty`) ||
      (expiry &&
        expiry <= receivedOn &&
        `Expiry date ${expiry} must be after the receiving date ${receivedOn} (BR-06)`);
    if (lotError) return beError(409, "RECEIPT_LOT_DATA_INVALID", lotError);
    counted.push({
      id: crypto.randomUUID(),
      purchaseOrderLineId: poLine.lineId,
      purchaseOrderLineNo: index + 1,
      inventoryItemId: policy.inventoryItemId,
      sku: poLine.sku,
      quantity: line.quantity as number,
      lotNumber: lot,
      expiryDate: expiry,
      locationCode: area.code ?? "",
      note: readString(line.note) || null,
      qcRequired: policy.qcRequired,
      qcProgress: policy.qcRequired ? "AWAITING_MOVE_TO_QC" : "NOT_REQUIRED",
      qcLocationCode: null,
      movedToQcAt: null,
      quantityForPutaway: policy.qcRequired ? 0 : (line.quantity as number),
      inspections: [],
    });
  }
  // BR-RCP-001: đếm vượt dung sai không còn bị từ chối — phiếu gắn cảnh báo, xác nhận thì chờ Quản lý kho duyệt
  // Aggregate: kiểm trạng thái sau phần tra cứu, như BE (load → policy → area → aggregate)
  if (notDraft) return notDraft;
  const keys = new Set<string>();
  for (const line of counted) {
    const key = `${line.purchaseOrderLineId}|${line.lotNumber ?? ""}`;
    if (keys.has(key)) {
      return beError(
        400,
        "VALIDATION_FAILED",
        `PO line ${line.purchaseOrderLineId}${line.lotNumber ? ` lot ${line.lotNumber}` : ""} appears twice; put the whole quantity of a lot on one line`,
      );
    }
    keys.add(key);
  }
  return saveReceipt({ ...receipt, lines: counted });
}

/** BE `GoodsReceiptServiceImpl#requireReceivable` (BR-01). */
function requireReceivablePo(po: MockBePo) {
  return RECEIVABLE_PO.includes(po.status)
    ? null
    : beError(
        409,
        "PURCHASE_ORDER_NOT_RECEIVABLE",
        `${po.poNumber} is ${po.status}; goods are received only against a CONFIRMED or PARTIALLY_RECEIVED order (BR-01)`,
      );
}

async function loadPo(receipt: MockReceipt) {
  const po = receipt.purchaseOrderId
    ? (await getPoStore()).get(receipt.purchaseOrderId)
    : undefined;
  return po
    ? { po }
    : {
        error: beError(
          404,
          "PURCHASE_ORDER_NOT_FOUND",
          `No purchase order ${receipt.purchaseOrderId}`,
        ),
      };
}

/** Ghi nhận phiếu: tồn Inbound, tiến độ PO, trạng thái sau xác nhận (BE `post`). */
async function post(receipt: MockReceipt, by: string, approval?: MockReceipt["approval"]) {
  const posted: MockReceipt = {
    ...receipt,
    status: receipt.lines.some((l) => l.qcRequired) ? "IN_QC" : "IN_PUTAWAY",
    confirmedAt: new Date().toISOString(),
    confirmedBy: by,
    approval: approval ?? receipt.approval ?? null,
  };
  await recordPoProgress(posted);
  return saveReceipt(posted);
}

function requestApproval(receipt: MockReceipt) {
  return saveReceipt({
    ...receipt,
    status: "PENDING_APPROVAL",
    approval: {
      requestedAt: new Date().toISOString(),
      requestedBy: MOCK_RECEIPT_ACTOR,
      requestedByName: null,
      decision: null,
      decidedAt: null,
      decidedBy: null,
      decidedByName: null,
      reason: null,
    },
  });
}

async function confirm(receipt: MockReceipt) {
  if (receipt.withoutPurchaseOrder) {
    // BR-RCP-002: phiếu không có PO không bao giờ ghi nhận ngay — luôn chờ Quản lý kho duyệt
    const notDraft = requireStatus(receipt, "DRAFT", "send for approval");
    if (notDraft) return notDraft;
    if (receipt.lines.length === 0)
      return invalidReceiptTransition(`Receipt ${receipt.number} has no lines to confirm`);
    return requestApproval(receipt);
  }
  const { po, error } = await loadPo(receipt);
  if (error) return error;
  const notReceivable = requireReceivablePo(po);
  if (notReceivable) return notReceivable;
  const notDraft = requireStatus(receipt, "DRAFT", "confirm");
  if (notDraft) return notDraft;
  if (receipt.lines.length === 0)
    return invalidReceiptTransition(`Receipt ${receipt.number} has no lines to confirm`);
  // BR-RCP-001: vượt dung sai → chờ Quản lý kho duyệt, chưa ghi nhận tồn
  if ((await overToleranceLines(receipt)).size > 0) return requestApproval(receipt);
  return post(receipt, MOCK_RECEIPT_ACTOR);
}

/** Lý do bắt buộc (`@NotBlank` → 400) + 4 mắt của BE `GoodsReceipt#requireDecidable`. */
function checkDecision(receipt: MockReceipt, body: Record<string, unknown>) {
  const notPending = requireStatus(receipt, "PENDING_APPROVAL", "decide");
  if (notPending) return notPending;
  const reason = readString(body.reason);
  if (!reason)
    return beError(400, "VALIDATION_FAILED", "Invalid request data", [
      { field: "reason", message: "must not be blank", code: "NotBlank" },
    ]);
  if (
    MOCK_APPROVER_ACTOR === receipt.receivedBy ||
    MOCK_APPROVER_ACTOR === receipt.approval?.requestedBy
  ) {
    return beError(
      409,
      "RECEIPT_SELF_APPROVAL",
      `Receipt ${receipt.number} cannot be decided by the person who counted it or asked for its approval`,
    );
  }
  return null;
}

function decided(
  receipt: MockReceipt,
  decision: "APPROVED" | "EXCESS_REJECTED" | "REJECTED",
  reason: string,
): NonNullable<MockReceipt["approval"]> {
  const requested = receipt.approval;
  return {
    requestedAt: requested?.requestedAt ?? receipt.receivedAt,
    requestedBy: requested?.requestedBy ?? receipt.receivedBy,
    requestedByName: requested?.requestedByName ?? null,
    decision,
    decidedAt: new Date().toISOString(),
    decidedBy: MOCK_APPROVER_ACTOR,
    decidedByName: null,
    reason,
  };
}

/** BR-RCP-001: Quản lý kho duyệt — ghi nhận đủ SL đã đếm. */
async function approve(receipt: MockReceipt, body: Record<string, unknown>) {
  const refused = checkDecision(receipt, body);
  if (refused) return refused;
  if (receipt.withoutPurchaseOrder) {
    // BR-RCP-002: ghi nhận tồn theo NCC của phiếu, không cộng gì cho đơn nào
    return post(
      receipt,
      MOCK_APPROVER_ACTOR,
      decided(receipt, "APPROVED", readString(body.reason)),
    );
  }
  const { po, error } = await loadPo(receipt);
  if (error) return error;
  const notReceivable = requireReceivablePo(po);
  if (notReceivable) return notReceivable;
  return post(receipt, MOCK_APPROVER_ACTOR, decided(receipt, "APPROVED", readString(body.reason)));
}

/**
 * BR-RCP-001: từ chối phần vượt — mỗi dòng PO chỉ giữ phần giới hạn còn lại (đặt × (1 + dung sai) trừ phiếu đã
 * ghi nhận); phần cắt lấy từ dòng đếm sau cùng; hết chỗ thì phiếu bị huỷ (BE `GoodsReceipt#cutBackTo`).
 */
async function rejectExcess(receipt: MockReceipt, body: Record<string, unknown>) {
  const refused = checkDecision(receipt, body);
  if (refused) return refused;
  if (receipt.withoutPurchaseOrder)
    return invalidReceiptTransition(
      `Cannot reject the excess of receipt ${receipt.number}: it has no purchase order`,
    );
  const { po, error } = await loadPo(receipt);
  if (error) return error;
  const toCut = new Map<string, number>();
  for (const line of receipt.lines) {
    const key = line.purchaseOrderLineId ?? "";
    toCut.set(key, (toCut.get(key) ?? 0) + line.quantity);
  }
  for (const [poLineId, counted] of toCut) {
    const poLine = po.lines.find((l) => l.lineId === poLineId);
    const allowed = poLine
      ? Math.max(
          mockReceivableLimit(poLine.quantityOrdered) -
            (await receivedElsewhere(poLineId, receipt.id)),
          0,
        )
      : counted;
    toCut.set(poLineId, Math.max(counted - allowed, 0));
  }
  const kept: MockReceiptLine[] = [];
  for (const line of [...receipt.lines].reverse()) {
    const key = line.purchaseOrderLineId ?? "";
    const cut = Math.min(toCut.get(key) ?? 0, line.quantity);
    toCut.set(key, (toCut.get(key) ?? 0) - cut);
    if (cut < line.quantity) {
      const quantity = line.quantity - cut;
      kept.unshift({ ...line, quantity, quantityForPutaway: line.qcRequired ? 0 : quantity });
    }
  }
  const decision = decided(receipt, "EXCESS_REJECTED", readString(body.reason));
  if (kept.length === 0) {
    return saveReceipt({ ...receipt, lines: [], status: "CANCELLED", approval: decision });
  }
  const notReceivable = requireReceivablePo(po);
  if (notReceivable) return notReceivable;
  return post({ ...receipt, lines: kept }, MOCK_APPROVER_ACTOR, decision);
}

/** BR-RCP-002: từ chối phiếu không có PO → huỷ cả phiếu, giữ quyết định + lý do. */
async function rejectBlind(receipt: MockReceipt, body: Record<string, unknown>) {
  const refused = checkDecision(receipt, body);
  if (refused) return refused;
  if (!receipt.withoutPurchaseOrder)
    return invalidReceiptTransition(
      `Receipt ${receipt.number} is against a purchase order: its excess is rejected, the receipt is not`,
    );
  return saveReceipt({
    ...receipt,
    status: "CANCELLED",
    approval: decided(receipt, "REJECTED", readString(body.reason)),
  });
}

/** Owner NOPO-ATTACH: PO gắn bổ sung chỉ là tham chiếu — tồn tại + cùng NCC; không đổi PO. */
async function referencePo(receipt: MockReceipt, body: Record<string, unknown>) {
  const poId = readString(body.purchaseOrderId);
  if (!poId)
    return beError(400, "VALIDATION_FAILED", "Invalid request data", [
      { field: "purchaseOrderId", message: "must not be null", code: "NotNull" },
    ]);
  const po = (await getPoStore()).get(poId);
  if (!po) return beError(404, "PURCHASE_ORDER_NOT_FOUND", `No purchase order ${poId}`);
  if (!receipt.withoutPurchaseOrder)
    return invalidReceiptTransition(
      `Cannot reference a purchase order on receipt ${receipt.number}: it is against a purchase order`,
    );
  if (receipt.status === "CANCELLED")
    return invalidReceiptTransition(`Receipt ${receipt.number} is cancelled`);
  if (po.supplierId !== receipt.supplierId)
    return beError(
      409,
      "RECEIPT_REFERENCE_SUPPLIER_MISMATCH",
      "The purchase order is not a purchase order of the supplier of the receipt",
    );
  return saveReceipt({
    ...receipt,
    referencedPurchaseOrderId: po.purchaseOrderId,
    referencedPurchaseOrderNumber: po.poNumber,
  });
}

/* ── Đăng ký ─────────────────────────────────────────────────────────── */

export function registerGoodsReceiptMockRoutes(): void {
  registerMockRoute("GET", PATH, async (config) => {
    const params = readParams(config);
    const page = readInt(params.page, 0);
    const size = readInt(params.size, BE_DEFAULT_PAGE_SIZE);
    if (size > BE_MAX_PAGE_SIZE)
      return beError(
        400,
        "VALIDATION_FAILED",
        `Page size must not exceed ${BE_MAX_PAGE_SIZE}, got ${size}`,
      );
    const statuses = ([] as unknown[])
      .concat(params.status ?? [])
      .map(readString)
      .filter(Boolean);
    const search = readString(params.search).toLowerCase();
    const from = readString(params.receivedFrom);
    const to = readString(params.receivedTo);
    const [sortField = "receivedAt", sortDir = "desc"] = readString(params.sort).split(",");
    const key = SORTABLE[sortField] ?? SORTABLE.receivedAt;

    const rows = [...(await getReceiptStore()).values()]
      .filter((r) => !statuses.length || statuses.includes(r.status))
      .filter(
        (r) =>
          !readString(params.purchaseOrderId) ||
          r.purchaseOrderId === readString(params.purchaseOrderId),
      )
      .filter(
        (r) => !readString(params.warehouseId) || r.warehouseId === readString(params.warehouseId),
      )
      .filter((r) => !search || r.number.toLowerCase().includes(search))
      .filter(
        (r) =>
          params.withoutPo === undefined ||
          (String(params.withoutPo) === "true") === !!r.withoutPurchaseOrder,
      )
      // BE receivedBetween: from ≤ receivedAt < to
      .filter(
        (r) =>
          (!from || r.receivedAt >= new Date(from).toISOString()) &&
          (!to || r.receivedAt < new Date(to).toISOString()),
      )
      .sort((a, b) => (sortDir === "asc" ? 1 : -1) * key(a).localeCompare(key(b)))
      // GoodsReceiptRowResponse: không kèm dòng
      .map(
        ({
          lines: _lines,
          purchaseOrderNumber: _po,
          note: _note,
          confirmedBy: _by,
          approval: _approval,
          warnings: _warnings,
          ...row
        }) => row,
      );
    return beOk(bePage(rows, page, size));
  });

  registerMockRoute("GET", `${PATH}/:id`, async (config) => {
    const { id, receipt } = await loadReceipt(config);
    return receipt ? beOk(await withWarnings(receipt)) : receiptNotFound(id);
  });

  // BR-RCP-002: hàng về không có PO — NCC, kho, lý do bắt buộc
  registerMockRoute("POST", `${PATH}/without-po`, async (config) => {
    const body = parseJsonBody(config.data);
    const supplierId = readString(body.supplierId);
    const warehouseId = readString(body.warehouseId);
    const reason = readString(body.reason).trim();
    const fieldErrors: MockFieldError[] = [];
    if (!supplierId)
      fieldErrors.push({ field: "supplierId", message: "must not be null", code: "NotNull" });
    if (!warehouseId)
      fieldErrors.push({ field: "warehouseId", message: "must not be null", code: "NotNull" });
    if (!reason)
      fieldErrors.push({ field: "reason", message: "must not be blank", code: "NotBlank" });
    if (fieldErrors.length)
      return beError(400, "VALIDATION_FAILED", "Invalid request data", fieldErrors);
    const supplier = await findMockSupplier(supplierId);
    if (!supplier) return beError(404, "SUPPLIER_NOT_FOUND", `No supplier ${supplierId}`);
    if (warehouseId !== MOCK_WAREHOUSE_ID)
      return beError(404, "WAREHOUSE_NOT_FOUND", `No warehouse ${warehouseId}`);
    const store = await getReceiptStore();
    const now = new Date().toISOString();
    const receipt: MockReceipt = {
      id: crypto.randomUUID(),
      number: nextReceiptNumber(now),
      purchaseOrderId: null,
      purchaseOrderNumber: null,
      supplierId: supplier.supplierId,
      supplierName: supplier.name,
      withoutPurchaseOrder: true,
      blindReason: reason,
      warehouseId,
      status: "DRAFT",
      deliveryNote: readString(body.deliveryNote) || null,
      note: readString(body.note) || null,
      receivedAt: now,
      receivedBy: MOCK_RECEIPT_ACTOR,
      confirmedAt: null,
      confirmedBy: null,
      closedAt: null,
      lines: [],
    };
    store.set(receipt.id, receipt);
    return beOk(receipt, 201);
  });

  registerMockRoute("GET", "/warehouses", async () =>
    beOk(bePage([MOCK_WAREHOUSE_OPTION], 0, BE_DEFAULT_PAGE_SIZE)),
  );

  registerMockRoute("POST", PATH, async (config) => {
    const body = parseJsonBody(config.data);
    const poId = readString(body.purchaseOrderId);
    if (!poId)
      return beError(400, "VALIDATION_FAILED", "Invalid request data", [
        { field: "purchaseOrderId", message: "must not be null", code: "NotNull" },
      ]);
    const po = (await getPoStore()).get(poId);
    if (!po) return beError(404, "PURCHASE_ORDER_NOT_FOUND", `No purchase order ${poId}`);
    if (!RECEIVABLE_PO.includes(po.status)) {
      return beError(
        409,
        "PURCHASE_ORDER_NOT_RECEIVABLE",
        `${po.poNumber} is ${po.status}; goods are received only against a CONFIRMED or PARTIALLY_RECEIVED order (BR-01)`,
      );
    }
    // Seed kho phiếu trước khi cấp số — seed đặt lại bộ đếm, cấp trước thì trùng số
    const store = await getReceiptStore();
    const now = new Date().toISOString();
    const receipt: MockReceipt = {
      id: crypto.randomUUID(),
      number: nextReceiptNumber(now),
      purchaseOrderId: po.purchaseOrderId,
      purchaseOrderNumber: po.poNumber,
      warehouseId: MOCK_WAREHOUSE_ID,
      status: "DRAFT",
      deliveryNote: readString(body.deliveryNote) || null,
      note: readString(body.note) || null,
      receivedAt: now,
      receivedBy: MOCK_RECEIPT_ACTOR,
      confirmedAt: null,
      confirmedBy: null,
      closedAt: null,
      lines: [],
    };
    store.set(receipt.id, receipt);
    return beOk(receipt, 201);
  });

  registerMockRoute("PUT", `${PATH}/:id/lines`, async (config) => {
    const { id, receipt } = await loadReceipt(config);
    return receipt ? replaceLines(receipt, parseJsonBody(config.data)) : receiptNotFound(id);
  });

  registerMockRoute("POST", `${PATH}/:id/confirmation`, async (config) => {
    const { id, receipt } = await loadReceipt(config);
    return receipt ? confirm(receipt) : receiptNotFound(id);
  });

  registerMockRoute("POST", `${PATH}/:id/approval`, async (config) => {
    const { id, receipt } = await loadReceipt(config);
    return receipt ? approve(receipt, parseJsonBody(config.data)) : receiptNotFound(id);
  });

  registerMockRoute("POST", `${PATH}/:id/rejection`, async (config) => {
    const { id, receipt } = await loadReceipt(config);
    return receipt ? rejectBlind(receipt, parseJsonBody(config.data)) : receiptNotFound(id);
  });

  registerMockRoute("PUT", `${PATH}/:id/referenced-purchase-order`, async (config) => {
    const { id, receipt } = await loadReceipt(config);
    return receipt ? referencePo(receipt, parseJsonBody(config.data)) : receiptNotFound(id);
  });

  registerMockRoute("POST", `${PATH}/:id/excess-rejection`, async (config) => {
    const { id, receipt } = await loadReceipt(config);
    return receipt ? rejectExcess(receipt, parseJsonBody(config.data)) : receiptNotFound(id);
  });

  registerMockRoute("POST", `${PATH}/:id/cancellation`, async (config) => {
    const { id, receipt } = await loadReceipt(config);
    if (!receipt) return receiptNotFound(id);
    // BE `GoodsReceipt#cancel`: phiếu chưa ghi nhận — Draft hoặc đang chờ duyệt
    if (receipt.status !== "DRAFT" && receipt.status !== "PENDING_APPROVAL")
      return invalidReceiptTransition(
        `Cannot cancel receipt ${receipt.number}: it is ${receipt.status}, not DRAFT or PENDING_APPROVAL`,
      );
    return saveReceipt({ ...receipt, status: "CANCELLED" });
  });

  registerGoodsReceiptQcMockRoutes();
}
