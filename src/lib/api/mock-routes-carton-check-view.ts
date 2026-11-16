/**
 * Mock trạm kiểm thùng — dựng câu trả lời đúng hình BE (`CartonCheckSessionResponse`, `CartonCheckQueueRowResponse`). BE
 * bật Jackson `non_null`: field chưa có giá trị bị BỎ khỏi JSON, mock cũng không để key `undefined`.
 */

import { labeledUnitsOf } from "./mock-carton-check-session";
import { mockCartonSpecs, unmeasuredSkusOf } from "./mock-routes-carton-check-store";

import type { Order } from "@/lib/mock-data";
import type { MockCarton, MockCheckSession } from "./mock-carton-check-session";

/** Bỏ các key có giá trị `undefined` (Jackson `non_null`). */
export function omitUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

/** Khoản đơn còn nợ trước bàn giao (mock: đơn không phải COD chưa trả đủ); null khi không nợ. */
export function amountDueOf(order: Order): number | null {
  const due = order.grandTotal - order.amountPaid;
  return order.paymentMethodType === "COD" || due <= 0 ? null : due;
}

/** `FulfillmentTaskResponse.PaymentDue` — của câu trả lời hoàn tất. */
export function taskPaymentDueOf(order: Order) {
  const due = amountDueOf(order);
  return due === null ? undefined : { amountDueBeforeHandover: due, currency: order.currency };
}

/**
 * Số cái cần giao của mỗi dòng đơn: dòng có thùng (dòng lấy hàng) cần đủ `quantity`; dòng không có thùng — mock-only,
 * dòng in theo thiết kế — không tính (xem ASSUMPTION ở `mock-routes-carton-check-store.ts`).
 */
export function wantedUnitsOf(order: Order, session: MockCheckSession): Map<string, number> {
  const withCartons = new Set(session.cartons.map((carton) => carton.orderLineId));
  return new Map(
    order.lines.map((line) => [line.lineId, withCartons.has(line.lineId) ? line.quantity : 0]),
  );
}

const cartonView = (carton: MockCarton) =>
  omitUndefined({
    packageId: carton.packageId,
    packageNo: carton.packageNo,
    labelCode: carton.labelCode,
    lpn: carton.lpn,
    pickLineId: carton.pickLineId,
    orderLineId: carton.orderLineId,
    sku: carton.sku,
    lotNumber: carton.lotNumber,
    quantity: carton.quantity,
    status: carton.status,
    checkedAt: carton.checkedAt,
    labeledAt: carton.labeledAt,
    labelVersion: carton.labelVersion,
    lengthCm: carton.lengthCm,
    widthCm: carton.widthCm,
    heightCm: carton.heightCm,
    weightKg: carton.weightKg,
    dimWeightKg: carton.dimWeightKg,
    rotatable: carton.rotatable,
    shipmentId: carton.shipmentId,
    removalReason: carton.removalReason,
    removalNote: carton.removalNote,
  });

/** BE `CartonCheckSessionResponse`. */
export function sessionView(session: MockCheckSession, packStatus: string, order: Order) {
  const wanted = wantedUnitsOf(order, session);
  const due = amountDueOf(order);
  return omitUndefined({
    taskId: session.taskId,
    orderId: order.orderId,
    orderNumber: order.orderNumber,
    warehouseId: order.fulfillmentWarehouseId,
    status: packStatus,
    startedBy: session.startedBy,
    startedByName: session.startedByName,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    orderLocked: session.cartons.some((carton) => carton.labelVersion > 0),
    lines: order.lines.map((line) => {
      const mine = session.cartons.filter((carton) => carton.orderLineId === line.lineId);
      const labeledUnits = labeledUnitsOf(session, line.lineId);
      const wantedUnits = wanted.get(line.lineId) ?? 0;
      return {
        orderLineId: line.lineId,
        sku: line.skuId,
        wantedUnits,
        cartons: mine.filter((c) => c.status !== "REMOVED").length,
        checkedCartons: mine.filter((c) => c.status === "CHECKED" || c.status === "LABELED").length,
        labeledCartons: mine.filter((c) => c.status === "LABELED").length,
        removedCartons: mine.filter((c) => c.status === "REMOVED").length,
        shippedCartons: mine.filter((c) => c.shipmentId).length,
        labeledUnits,
        missingUnits: Math.max(0, wantedUnits - labeledUnits),
      };
    }),
    cartons: session.cartons.map(cartonView),
    shipments: session.shipments.map(({ requestId: _requestId, ...shipment }) =>
      omitUndefined(shipment),
    ),
    paymentDue: due === null ? undefined : { amount: due, currency: order.currency },
    skusWithoutCartonSpec: unmeasuredSkusOf(
      session.cartons
        .filter((carton) => carton.status === "TO_CHECK" || carton.status === "CHECKED")
        .map((carton) => carton.sku),
    ),
  });
}

/** Quy cách thùng mock cho các SKU của phiên — để dán nhãn / in lại. */
export const specsOf = (session: MockCheckSession) =>
  mockCartonSpecs(session.cartons.map((carton) => carton.sku));
