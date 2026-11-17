/**
 * Mock routes — phiếu nhập hàng hoàn (BE `ReturnReceiptController`, `/goods-receipts/returns`; docs 03 §4.2, BR-14):
 *   GET    /goods-receipts/returns                 danh sách (status lặp, returnRequestId, orderId)
 *   GET    /goods-receipts/returns/{id}            phiếu + thùng đã quét + thùng của nguồn
 *   POST   /goods-receipts/returns                 lập phiếu DRAFT từ RMA AWAITING_RETURN (mock chưa có chuyến RTO)
 *   POST   /goods-receipts/returns/{id}/cartons    quét LPN (+ tình trạng)
 *   DELETE /goods-receipts/returns/{id}/cartons/{lpn}
 *   POST   /goods-receipts/returns/{id}/confirmation   CLOSED; yêu cầu trả hàng → RECEIVED
 *   POST   /goods-receipts/returns/{id}/cancellation   CANCELLED
 * Phải đăng ký TRƯỚC `/goods-receipts/:id` (mock adapter khớp route đăng ký trước).
 */

import { registerMockRoute } from "./mock-adapter";
import {
  mockReturnReceipts,
  mockReturns,
  nextMockReturnId,
  sourceCartonsOf,
} from "./mock-returns-store";
import { bodyOf, fail, ok, pageOf, pathParams, queryOf, text } from "./mock-route-utils";
import { mockUsableAreaCodes } from "./mock-routes-warehouse-layout";

import type { MockReturnReceipt } from "./mock-returns-store";

const BASE = "/goods-receipts/returns";
const now = () => new Date().toISOString();
const byId = (id: string) => mockReturnReceipts().find((r) => r.id === id);
const notFound = (id: string) => fail(404, "GOODS_RECEIPT_NOT_FOUND", `No receipt ${id}`);
const notDraft = () => fail(409, "INVALID_RECEIPT_TRANSITION", "The receipt is not a draft");

function wire(receipt: MockReturnReceipt) {
  const { source, ...rest } = receipt;
  const scanned = new Set(receipt.cartons.map((c) => c.lpn));
  return {
    ...rest,
    receiptType: "RETURN",
    expectedCartons: source.map((c) => ({ ...c, scanned: scanned.has(c.lpn) })),
  };
}

function row(receipt: MockReturnReceipt) {
  return {
    id: receipt.id,
    number: receipt.number,
    receiptType: "RETURN",
    status: receipt.status,
    warehouseId: receipt.warehouseId,
    orderId: receipt.orderId,
    shipmentId: receipt.shipmentId,
    returnRequestId: receipt.returnRequestId,
    receivedAt: receipt.receivedAt,
    closedAt: receipt.closedAt,
    cartonCount: receipt.cartons.length,
  };
}

async function create(body: Record<string, unknown>) {
  const returnRequestId = text(body.returnRequestId);
  const shipmentId = text(body.shipmentId);
  if (!!returnRequestId === !!shipmentId)
    return fail(400, "VALIDATION_FAILED", "Exactly one of shipmentId and returnRequestId");
  if (shipmentId) return fail(404, "SHIPMENT_NOT_FOUND", "Mock has no returned shipment");
  const ret = mockReturns().find((r) => r.id === returnRequestId);
  if (!ret) return fail(404, "RETURN_REQUEST_NOT_FOUND", "No return request");
  if (ret.status !== "AWAITING_RETURN")
    return fail(409, "RETURN_NOT_AWAITING_GOODS", "Not awaiting its goods");
  const open = mockReturnReceipts().find(
    (r) => r.returnRequestId === ret.id && r.status !== "CANCELLED",
  );
  if (open)
    return fail(409, "RETURN_RECEIPT_ALREADY_OPEN", "Already open", [], { receiptId: open.id });
  const code = text(body.quarantineLocationCode);
  const usable = await mockUsableAreaCodes(ret.warehouseId, "QUARANTINE");
  // Kho mock-data cũ chưa có khu QUARANTINE ở bản đồ → nhận mọi mã (ASSUMPTION mock-only)
  if (usable.length && !usable.includes(code))
    return fail(409, "LOCATION_AREA_MISMATCH", `${code} is not a QUARANTINE area`);
  const id = nextMockReturnId("RRC");
  const receipt: MockReturnReceipt = {
    id,
    number: `GR-RET-${id.slice(-4)}`,
    status: "DRAFT",
    warehouseId: ret.warehouseId,
    orderId: ret.orderId,
    orderNumber: ret.orderNumber,
    shipmentId: null,
    shipmentCode: null,
    returnRequestId: ret.id,
    rmaNumber: ret.rmaNumber,
    quarantineLocationCode: code,
    note: text(body.note) || null,
    receivedAt: now(),
    closedAt: null,
    cartons: [],
    source: sourceCartonsOf(ret),
    version: 0,
  };
  mockReturnReceipts().unshift(receipt);
  return ok(wire(receipt), 201);
}

function scan(receipt: MockReturnReceipt, body: Record<string, unknown>) {
  if (receipt.status !== "DRAFT") return notDraft();
  const lpn = text(body.lpn);
  const carton = receipt.source.find((c) => c.lpn === lpn);
  if (!carton) return fail(409, "RETURN_CARTON_NOT_OF_SOURCE", `${lpn} is not of this source`);
  const condition = text(body.condition) || null;
  const existing = receipt.cartons.find((c) => c.lpn === lpn);
  if (existing) existing.condition = condition ?? existing.condition;
  else receipt.cartons.push({ ...carton, condition, scannedAt: now() });
  receipt.version += 1;
  return ok(wire(receipt));
}

function confirm(receipt: MockReturnReceipt) {
  if (receipt.status === "CLOSED") return ok(wire(receipt));
  if (receipt.status !== "DRAFT" || !receipt.cartons.length) return notDraft();
  receipt.status = "CLOSED";
  receipt.closedAt = now();
  receipt.version += 1;
  const ret = mockReturns().find((r) => r.id === receipt.returnRequestId);
  if (ret && (ret.status === "AWAITING_RETURN" || ret.status === "EXPIRED")) {
    for (const line of ret.lines)
      line.receivedQuantity = receipt.cartons
        .filter((c) => c.sku === line.sku)
        .reduce((sum, c) => sum + c.quantity, 0);
    ret.receipt = {
      receivedAt: now(),
      locationCode: receipt.quarantineLocationCode,
      goodsReceiptId: receipt.id,
    };
    ret.history.push({
      from: ret.status,
      to: "RECEIVED",
      reason: receipt.number,
      occurredAt: now(),
    });
    ret.status = "RECEIVED";
    ret.version += 1;
  }
  return ok(wire(receipt));
}

export function registerReturnReceiptMockRoutes(): void {
  registerMockRoute("GET", BASE, (config) => {
    const params = queryOf(config);
    const statuses = params.getAll("status");
    const items = mockReturnReceipts()
      .filter((r) => !statuses.length || statuses.includes(r.status))
      .filter(
        (r) =>
          !params.get("returnRequestId") || r.returnRequestId === params.get("returnRequestId"),
      )
      .filter((r) => !params.get("orderId") || r.orderId === params.get("orderId"))
      .map(row);
    return ok(pageOf(items, Number(params.get("page") ?? 0), Number(params.get("size") ?? 15)));
  });
  registerMockRoute("POST", BASE, (config) => create(bodyOf(config)));
  const withReceipt =
    (
      fn: (
        receipt: MockReturnReceipt,
        config: Parameters<typeof bodyOf>[0],
      ) => ReturnType<typeof ok>,
    ) =>
    (config: Parameters<typeof bodyOf>[0]) => {
      const id = pathParams(config).id ?? "";
      const receipt = byId(id);
      return receipt ? fn(receipt, config) : notFound(id);
    };
  registerMockRoute(
    "GET",
    `${BASE}/:id`,
    withReceipt((r) => ok(wire(r))),
  );
  registerMockRoute(
    "POST",
    `${BASE}/:id/cartons`,
    withReceipt((r, c) => scan(r, bodyOf(c))),
  );
  registerMockRoute(
    "DELETE",
    `${BASE}/:id/cartons/:lpn`,
    withReceipt((r, c) => {
      if (r.status !== "DRAFT") return notDraft();
      r.cartons = r.cartons.filter((carton) => carton.lpn !== pathParams(c).lpn);
      r.version += 1;
      return ok(wire(r));
    }),
  );
  registerMockRoute(
    "POST",
    `${BASE}/:id/confirmation`,
    withReceipt((r) => confirm(r)),
  );
  registerMockRoute(
    "POST",
    `${BASE}/:id/cancellation`,
    withReceipt((r) => {
      if (r.status !== "DRAFT") return notDraft();
      r.status = "CANCELLED";
      r.closedAt = now();
      r.version += 1;
      return ok(wire(r));
    }),
  );
}
