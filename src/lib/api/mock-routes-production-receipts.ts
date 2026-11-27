/**
 * Mock routes — phiếu nhập theo Đơn sản xuất (docs 03 §4.1, BE `GoodsReceiptController` 4A-5, FE SCRUM-566). Chỉ
 * dùng khi USE_MOCK=true.
 *
 *   POST /goods-receipts/production       lập phiếu DRAFT (BR-01 / BR-15)
 *   PUT  /goods-receipts/{id}/lines        thay toàn bộ bản đếm theo thùng (BR-02, BR-03, BR-12, BR-13)
 *   confirmProductionReceipt               xác nhận → IN_PUTAWAY (gọi từ route xác nhận chung)
 *
 * Trả đúng hợp đồng BE: mã lỗi, HTTP status, `fieldErrors` theo `lines[i]…`. Message lỗi tiếng Anh như BE.
 */

import { registerMockRoute } from "./mock-adapter";
import { cartonsInStock, nextLpn } from "./mock-receipt-cartons";
import {
  MOCK_RECEIPT_ACTOR,
  invalidReceiptTransition,
  loadReceipt,
  nextReceiptNumber,
  productionCartonsOf,
  receiptNotFound,
  saveReceipt,
} from "./mock-routes-goods-receipts-store";
import { findMockProductionOrder } from "./mock-routes-orders-actions";
import { readBody } from "./mock-routes-orders-store";
import { beError, isRecord, readString } from "./mock-routes-purchase-orders-store";
import { mockUsableAreaCodes } from "./mock-routes-warehouse-layout";

import type { MockReceiptPackage } from "./mock-receipt-cartons";
import type { MockReceipt, MockReceiptLine } from "./mock-routes-goods-receipts-store";
import type { MockProductionOrder } from "./mock-routes-orders-actions";
import type { MockFieldError } from "./mock-routes-purchase-orders-store";

const PATH = "/goods-receipts";

/** BR-15 (docs 03 §6) — như BE `GoodsReceiptServiceImpl#requireReceivable`. */
function receivable(order: MockProductionOrder): boolean {
  if (order.status === "IN_PRODUCTION" || order.status === "PARTIALLY_RECEIVED") return true;
  return (order.status === "SENT" || order.status === "ACCEPTED") && !order.sampleApprovalRequired;
}

function notReceivable(order: MockProductionOrder) {
  return beError(
    409,
    "PRODUCTION_ORDER_NOT_RECEIVABLE",
    `Production order ${order.code} is ${order.status}: goods are not received against it`,
  );
}

/** Thùng giữ chỗ trên mọi phiếu chưa huỷ khác (kể cả nháp) — BR-02 tính cả phiếu nháp. */
const notCancelled = (status: string) => status !== "CANCELLED";

interface RawLine {
  productionOrderLineId: string;
  locationCode: string;
  lpns: string[];
  fresh: number;
}

function readLines(body: Record<string, unknown>): RawLine[] {
  const lines = Array.isArray(body.lines) ? body.lines : [];
  return lines.map((raw: unknown) => {
    const line = isRecord(raw) ? raw : {};
    const packages = Array.isArray(line.packages) ? line.packages : [];
    const lpns = packages.flatMap((p: unknown) =>
      isRecord(p) && typeof p.lpn === "string" && p.lpn ? [p.lpn] : [],
    );
    return {
      productionOrderLineId: readString(line.productionOrderLineId),
      locationCode: readString(line.locationCode).trim().toUpperCase(),
      lpns,
      fresh: packages.length - lpns.length,
    };
  });
}

async function countLines(receipt: MockReceipt, order: MockProductionOrder, raws: RawLine[]) {
  const errors: (MockFieldError & { code: string })[] = [];
  const add = (i: number, field: string, code: string, message: string) =>
    errors.push({ field: `lines[${i}].${field}`, code, message });
  const receiving = await mockUsableAreaCodes(receipt.warehouseId, "RECEIVING");
  const now = new Date();
  const lines = raws.map((raw, i): MockReceiptLine | null => {
    const orderLine = order.lines.find((l) => l.id === raw.productionOrderLineId);
    if (!orderLine) {
      add(
        i,
        "productionOrderLineId",
        "RECEIPT_LINE_NOT_ON_PRODUCTION_ORDER",
        "Not a line of the production order",
      );
      return null;
    }
    if (!receiving.includes(raw.locationCode))
      add(
        i,
        "locationCode",
        "LOCATION_AREA_MISMATCH",
        `${raw.locationCode} is not a RECEIVING area of the warehouse`,
      );
    const was = receipt.lines.find((l) => l.productionOrderLineId === orderLine.id);
    const before = was?.packages ?? [];
    raw.lpns.forEach((lpn, j) => {
      if (!before.some((p) => p.lpn === lpn && p.status === "RECEIVING"))
        add(
          i,
          `packages[${j}].lpn`,
          "STOCK_PACKAGE_NOT_FOUND",
          `${lpn} is not a RECEIVING carton of this line`,
        );
    });
    const cartons = raw.lpns.length + raw.fresh;
    if (cartons === 0) add(i, "packages", "VALIDATION_FAILED", "A line lists at least one carton");
    const others = productionCartonsOf(orderLine.id, notCancelled, receipt.id);
    if (others + cartons > orderLine.cartons)
      add(
        i,
        "packages",
        "RECEIPT_EXCEEDS_PRODUCTION_ORDER",
        `${others + cartons} cartons, the line orders ${orderLine.cartons}`,
      );
    const kept = new Set(raw.lpns);
    const measured = {
      quantity: orderLine.unitsPerCarton,
      countedAt: now.toISOString(),
      nominalQty: orderLine.unitsPerCarton,
      locationCode: raw.locationCode,
    };
    const packages: MockReceiptPackage[] = [
      ...before.map((p) =>
        p.status !== "RECEIVING"
          ? p
          : kept.has(p.lpn)
            ? { ...p, ...measured }
            : { ...p, status: "VOID" as const },
      ),
      ...Array.from({ length: raw.fresh }, () => ({
        id: crypto.randomUUID(),
        lpn: nextLpn(now),
        status: "RECEIVING" as const,
        ...measured,
      })),
    ];
    return {
      id: was?.id ?? crypto.randomUUID(),
      purchaseOrderLineId: null,
      purchaseOrderLineNo: null,
      inventoryItemId: `item-${orderLine.sku}`,
      sku: orderLine.sku,
      quantity: cartons * orderLine.unitsPerCarton,
      // BR-03 (docs 03 §6): lô = mã Đơn sản xuất, hệ thống tự gán
      lotNumber: order.code,
      expiryDate: null,
      locationCode: raw.locationCode,
      note: null,
      quantityForPutaway: 0,
      unitOfMeasure: "CARTON",
      packages,
      productionOrderLineId: orderLine.id,
      orderedCartons: orderLine.cartons,
      unitsPerCarton: orderLine.unitsPerCarton,
    };
  });
  const first = errors[0];
  if (first) {
    const status =
      first.code === "STOCK_PACKAGE_NOT_FOUND"
        ? 404
        : first.code === "VALIDATION_FAILED"
          ? 400
          : 409;
    return { error: beError(status, first.code, `Receipt line: ${first.message}`, errors) };
  }
  const counted = lines.filter((line): line is MockReceiptLine => line !== null);
  // Docs 03 §4.1 bước 5: dòng đã có thùng không bỏ khỏi phiếu được
  if (receipt.lines.some((line) => !counted.some((c) => c.id === line.id)))
    return {
      error: beError(
        409,
        "RECEIPT_LINE_HAS_PACKAGES",
        "A line that has had cartons cannot be left out",
      ),
    };
  return { lines: counted };
}

/**
 * Docs 03 §4.1 bước 6: thùng → IN_STOCK (tồn Inbound), phiếu → IN_PUTAWAY. Mock không kiểm lại BR-02 ở đây — `PUT
 * /lines` đã chặn tổng thùng mọi phiếu chưa huỷ vượt số đặt.
 */
export function confirmProductionReceipt(receipt: MockReceipt) {
  if (receipt.status !== "DRAFT")
    return invalidReceiptTransition(
      `Cannot confirm receipt ${receipt.number}: it is ${receipt.status}`,
    );
  if (receipt.lines.length === 0)
    return beError(422, "VALIDATION_FAILED", `Receipt ${receipt.number} has no lines to confirm`);
  const at = new Date().toISOString();
  return saveReceipt({
    ...receipt,
    status: "IN_PUTAWAY",
    confirmedAt: at,
    confirmedBy: MOCK_RECEIPT_ACTOR,
    lines: receipt.lines.map((line) => ({
      ...cartonsInStock(line),
      quantityForPutaway: line.quantity,
    })),
  });
}

export function registerProductionReceiptMockRoutes(): void {
  registerMockRoute("POST", `${PATH}/production`, async (config) => {
    const body = readBody(config);
    const id = readString(body.productionOrderId);
    if (!id)
      return beError(400, "VALIDATION_FAILED", "The production order is required", [
        { field: "productionOrderId", message: "The production order is required" },
      ]);
    const order = await findMockProductionOrder(id);
    if (!order) return beError(404, "PRODUCTION_ORDER_NOT_FOUND", `No production order ${id}`);
    if (!receivable(order)) return notReceivable(order);
    const at = new Date().toISOString();
    return saveReceipt({
      id: crypto.randomUUID(),
      number: nextReceiptNumber(at),
      purchaseOrderId: null,
      purchaseOrderNumber: null,
      warehouseId: order.receivingWarehouseId ?? "",
      status: "DRAFT",
      deliveryNote: readString(body.deliveryNote) || null,
      note: readString(body.note) || null,
      receivedAt: at,
      receivedBy: MOCK_RECEIPT_ACTOR,
      confirmedAt: null,
      confirmedBy: null,
      closedAt: null,
      lines: [],
      productionOrderId: order.id,
      productionOrderCode: order.code,
    });
  });

  registerMockRoute("PUT", `${PATH}/:id/lines`, async (config) => {
    const { id, receipt } = await loadReceipt(config);
    if (!receipt) return receiptNotFound(id);
    if (!receipt.productionOrderId)
      return invalidReceiptTransition(
        `Receipt ${receipt.number} is a purchase receipt: it is only cancelled`,
      );
    if (receipt.status !== "DRAFT")
      return invalidReceiptTransition(
        `Cannot change the lines of receipt ${receipt.number}: it is ${receipt.status}`,
      );
    const order = await findMockProductionOrder(receipt.productionOrderId);
    if (!order) return beError(404, "PRODUCTION_ORDER_NOT_FOUND", "No production order");
    if (!receivable(order)) return notReceivable(order);
    const raws = readLines(readBody(config));
    if (raws.length === 0) return beError(400, "VALIDATION_FAILED", "lines must not be empty");
    const result = await countLines(receipt, order, raws);
    if (result.error) return result.error;
    return saveReceipt({ ...receipt, lines: result.lines });
  });
}
