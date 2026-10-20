/**
 * Mock `PUT /purchase-orders/{id}` — sửa PO nháp (BE SCRUM-462, `PurchaseOrderController#update`,
 * `ProcurementServiceImpl#reviseDraft`, `PurchaseOrder#reviseDraft`). Tách khỏi
 * `mock-routes-purchase-orders.ts` (đã vượt 400 dòng).
 */

import { registerMockRoute } from "./mock-adapter";
import {
  isPossibleDuplicate,
  readCreateLines,
  typedUnitPrice,
  withUnitPrice,
} from "./mock-routes-purchase-orders";
import {
  BE_GENERIC_VALIDATION_MESSAGE,
  MOCK_WAREHOUSE,
  beError,
  beOk,
  getPoStore,
  isRecord,
  notFound,
  parseJsonBody,
  readRouteId,
  readString,
  sumLines,
  sumTax,
  touch,
} from "./mock-routes-purchase-orders-store";
import { catalogTermsViolations } from "./mock-routes-supplier-items-store";

import type { AxiosRequestConfig } from "axios";
import type { MockBePo, MockBePoLine, MockFieldError } from "./mock-routes-purchase-orders-store";

/** BE `UpdatePurchaseOrderRequest.lines` @Size(max = 200), `note` @Size(max = 2000). */
const MAX_LINES = 200;
const MAX_NOTE = 2000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const validation = (message: string, fieldErrors: MockFieldError[] = []) =>
  beError(400, "VALIDATION_FAILED", message, fieldErrors);

/** `lineId` của từng dòng thô; null khi thiếu hoặc sai định dạng UUID (lỗi ghi vào `fieldErrors`). */
function readLineIds(rawLines: unknown[], fieldErrors: MockFieldError[]): (string | null)[] {
  return rawLines.map((raw, idx) => {
    const id = isRecord(raw) ? raw.lineId : null;
    if (id == null) return null;
    if (typeof id === "string" && UUID_PATTERN.test(id)) return id.toLowerCase();
    fieldErrors.push({ field: `lines[${idx}].lineId`, message: "lineId must be a UUID" });
    return null;
  });
}

/**
 * Dòng của bản sửa theo `PurchaseOrder#reviseDraft`: `lineId` phải là dòng đang có, không trùng,
 * và giữ nguyên SKU của nó; dòng mới nối số dòng tiếp theo; dòng không gửi bị xoá.
 */
function reviseLines(
  po: MockBePo,
  wanted: readonly MockBePoLine[],
  lineIds: readonly (string | null)[],
): MockBePoLine[] | ReturnType<typeof validation> {
  const current = new Map(po.lines.map((l) => [l.lineId.toLowerCase(), l]));
  const kept = new Set<string>();
  let nextLineNo = Math.max(0, ...po.lines.map((l) => l.lineNo)) + 1;
  const revised: MockBePoLine[] = [];
  for (const [i, line] of wanted.entries()) {
    const lineId = lineIds[i] ?? null;
    if (lineId === null) {
      revised.push({ ...line, lineNo: nextLineNo++ });
      continue;
    }
    const existing = current.get(lineId);
    if (!existing) return validation(`Line ${lineId} is not on purchase order ${po.poNumber}`);
    if (!kept.add(lineId)) return validation(`Line ${lineId} is listed twice`);
    if (existing.sku !== line.sku) {
      return validation(`Line ${lineId} keeps its SKU ${existing.sku}; add a new line instead`);
    }
    revised.push({ ...line, lineId: existing.lineId, lineNo: existing.lineNo });
  }
  return revised;
}

async function updateDraft(config: AxiosRequestConfig) {
  const id = readRouteId(config);
  const body = parseJsonBody(config.data);
  const warehouseId = readString(body.warehouseId);
  const expectedAt = readString(body.expectedAt);
  const note = readString(body.note) || null;
  const rawLines: unknown[] = Array.isArray(body.lines) ? body.lines : [];
  const fieldErrors: MockFieldError[] = [];
  // Bean validation của `UpdatePurchaseOrderRequest` — chạy trước cả khi tìm PO (như @Valid).
  if (typeof body.version !== "number" || !Number.isInteger(body.version)) {
    fieldErrors.push({ field: "version", message: "version is required" });
  }
  if (!warehouseId) fieldErrors.push({ field: "warehouseId", message: "warehouseId is required" });
  if (!ISO_DATE_PATTERN.test(expectedAt)) {
    fieldErrors.push({ field: "expectedAt", message: "expectedAt is required" });
  }
  if (note && note.length > MAX_NOTE) {
    fieldErrors.push({ field: "note", message: `size must be ≤ ${MAX_NOTE}` });
  }
  if (rawLines.length === 0) {
    fieldErrors.push({ field: "lines", message: "at least one line is required" });
  } else if (rawLines.length > MAX_LINES) {
    fieldErrors.push({ field: "lines", message: `At most ${MAX_LINES} lines` });
  }
  const parsedLines = readCreateLines(rawLines, fieldErrors);
  const lineIds = readLineIds(rawLines, fieldErrors);
  if (fieldErrors.length > 0) return validation(BE_GENERIC_VALIDATION_MESSAGE, fieldErrors);

  const store = await getPoStore();
  const po = store.get(id);
  if (!po) return notFound(id);
  // BE `reviseDraft`: chỉ DRAFT + STANDARD; rồi so version (lạc quan).
  if (po.status !== "DRAFT" || po.type !== "STANDARD") {
    return beError(
      409,
      "PURCHASE_ORDER_NOT_EDITABLE",
      `Purchase order ${po.poNumber} is ${po.status} ${po.type}`,
    );
  }
  if (body.version !== po.version) {
    return beError(
      409,
      "OPTIMISTIC_LOCK",
      `Purchase order ${po.poNumber} changed since it was read; reload it`,
    );
  }
  if (warehouseId !== MOCK_WAREHOUSE.id) {
    return beError(404, "WAREHOUSE_NOT_FOUND", `No warehouse with id ${warehouseId}`);
  }
  if (new Set(parsedLines.map((l) => l.sku)).size !== parsedLines.length) {
    return validation("A SKU can appear on a purchase order only once");
  }
  // BR-PO-001 (BE checkLines): MỌI dòng (cũ lẫn mới) kiểm lại theo danh mục hiện tại; thiếu
  // `unitPrice` ⇒ giá danh mục (dòng cũ bỏ giá = thay giá thương lượng bằng giá danh mục).
  const check = await catalogTermsViolations(
    po.supplierId,
    po.currency,
    parsedLines.map((l, i) => ({
      sku: l.sku,
      quantityOrdered: l.quantityOrdered,
      unitPrice: typedUnitPrice(rawLines[i]),
    })),
  );
  if (check.fieldErrors.length > 0) {
    return beError(
      409,
      "SUPPLIER_TERMS_VIOLATED",
      `${check.fieldErrors.length} line(s) break the supplier's catalog terms`,
      check.fieldErrors,
    );
  }
  if (expectedAt < po.orderDate) {
    return validation("The expected delivery date cannot be before the order date");
  }
  const priced = parsedLines.map((l, i) => withUnitPrice(l, check.prices[i] ?? l.unitPrice));
  const lines = reviseLines(po, priced, lineIds);
  if (!Array.isArray(lines)) return lines;
  const subtotal = sumLines(lines);
  const taxTotal = sumTax(lines);
  const updated = touch(po, {
    warehouseId,
    expectedAt,
    note,
    lines,
    subtotal,
    taxTotal,
    totalAmount: subtotal + taxTotal,
    leadTimeDays: check.leadTimeDays,
  });
  store.set(id, updated);
  return beOk({ ...updated, possibleDuplicate: isPossibleDuplicate(store, updated) });
}

export function registerPoDraftMockRoutes(): void {
  registerMockRoute("PUT", "/purchase-orders/:id", updateDraft);
}
