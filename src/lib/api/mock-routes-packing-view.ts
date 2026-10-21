/**
 * Mock trạm đóng gói — dựng câu trả lời đúng hình BE (`PackingSessionResponse`, `PackageResponse`,
 * `PackageLabelResponse`). BE bật Jackson `non_null`: field chưa có giá trị bị BỎ khỏi JSON, mock cũng
 * không để key `undefined`.
 */

import { codOf } from "./mock-routes-packing-store";
import { packedOf, shippedOf } from "./mock-packing-session";

import type { Order } from "@/lib/mock-data";
import type {
  PackLineState,
  PackSessionState,
  ParcelState,
  ShipmentState,
} from "./mock-packing-session";

/** Bỏ các key có giá trị `undefined` (Jackson `non_null`). */
export function omitUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

/** BE `PaymentDue`: khoản đơn còn nợ trước bàn giao (mock: đơn không phải COD chưa trả đủ). */
export function paymentDueOf(order: Order) {
  const due = order.grandTotal - order.amountPaid;
  if (order.paymentMethodType === "COD" || due <= 0) return undefined;
  return { amountDueBeforeHandover: due, currency: order.currency };
}

function lineView(s: PackSessionState, line: PackLineState) {
  const packed = packedOf(s, line.orderLineId);
  return omitUndefined({
    orderLineId: line.orderLineId,
    sku: line.sku,
    barcode: line.barcode,
    printLine: line.printLine,
    designSnapshotId: line.designSnapshotId,
    wanted: line.wanted,
    available: line.available,
    packed,
    shipped: shippedOf(s, line.orderLineId),
    remaining: Math.max(0, line.wanted - packed),
    lotTracked: Object.keys(line.lots).length > 0,
    serialTracked: line.serials.length > 0,
    lots: Object.entries(line.lots).map(([lotNumber, available]) => ({
      lotNumber,
      available,
      packed: s.parcels
        .filter((p) => p.status !== "VOIDED")
        .flatMap((p) => p.contents)
        .filter((c) => c.orderLineId === line.orderLineId && c.lotNumber === lotNumber)
        .reduce((sum, c) => sum + c.quantity, 0),
    })),
  });
}

export function parcelView(s: PackSessionState, parcel: ParcelState) {
  return omitUndefined({
    packageId: parcel.packageId,
    packageNo: parcel.packageNo,
    labelCode: parcel.labelCode,
    packageType: parcel.packageType,
    status: parcel.status,
    shipmentId: parcel.shipmentId,
    weightKg: parcel.weightKg,
    lengthCm: parcel.lengthCm,
    widthCm: parcel.widthCm,
    heightCm: parcel.heightCm,
    dimWeightKg: parcel.dimWeightKg,
    rotatable: parcel.rotatable,
    rotatableOverridden: parcel.rotatableOverridden,
    fragile: parcel.fragile,
    fragileOverridden: parcel.fragileOverridden,
    sealedAt: parcel.sealedAt,
    contents: parcel.contents.map((c) =>
      omitUndefined({
        orderLineId: c.orderLineId,
        sku: s.lines.find((l) => l.orderLineId === c.orderLineId)?.sku ?? "",
        lotNumber: c.lotNumber,
        serialNumber: c.serialNumber,
        quantity: c.quantity,
      }),
    ),
  });
}

function shipmentView(shipment: ShipmentState) {
  return omitUndefined({
    shipmentId: shipment.shipmentId,
    code: shipment.code,
    status: shipment.status,
    deliveryMode: "PARCEL",
    packageCount: shipment.packageCount,
    codAmount: shipment.codAmount,
    partial: shipment.partial,
    partialNote: shipment.partialNote,
    readyAt: shipment.readyAt,
  });
}

/** BE `PackingSessionResponse`. */
export function sessionView(s: PackSessionState, packStatus: string, order: Order) {
  return omitUndefined({
    taskId: s.taskId,
    orderId: order.orderId,
    orderNumber: order.orderNumber,
    warehouseId: order.fulfillmentWarehouseId,
    packStatus,
    packerId: s.packerId,
    packerName: s.packerName,
    startedAt: s.startedAt,
    packedAt: s.packedAt,
    lines: s.lines.map((line) => lineView(s, line)),
    packages: s.parcels.map((p) => parcelView(s, p)),
    shipments: s.shipments.map(shipmentView),
    paymentDue: paymentDueOf(order),
  });
}

/**
 * BE `PackageLabelResponse` (docs 08 bước 6). Kiện đã vào lô: n/N của lô, COD đã chốt. Kiện chưa vào
 * lô: nhãn TẠM — n/N và COD tính theo các kiện đã niêm phong sẽ giao cùng lúc, có thể đổi.
 */
export function labelView(
  s: PackSessionState,
  parcel: ParcelState,
  order: Order,
  warehouse: { name: string; address: string } | undefined,
) {
  const shipment = s.shipments.find((x) => x.shipmentId === parcel.shipmentId);
  const group = shipment
    ? s.parcels.filter((p) => p.shipmentId === shipment.shipmentId)
    : s.parcels.filter((p) => p.status === "SEALED" && !p.shipmentId);
  const index = group
    .sort((a, b) => a.packageNo - b.packageNo)
    .findIndex((p) => p.packageId === parcel.packageId);
  const value = group
    .flatMap((p) => p.contents)
    .reduce(
      (sum, c) =>
        sum + (s.lines.find((l) => l.orderLineId === c.orderLineId)?.unitPrice ?? 0) * c.quantity,
      0,
    );
  const address = order.shippingAddress;
  return omitUndefined({
    labelCode: parcel.labelCode,
    packageId: parcel.packageId,
    orderNumber: order.orderNumber,
    shipmentId: shipment?.shipmentId,
    shipmentCode: shipment?.code,
    packageNo: index + 1,
    packageCount: shipment?.packageCount ?? group.length,
    provisional: !shipment,
    codAmount: shipment ? shipment.codAmount : codOf(order, s.shipments, value),
    currency: order.currency,
    recipient: {
      name: order.recipientName,
      phone: order.recipientPhone,
      line1: address.street,
      line2: address.district,
      wardName: address.ward,
      provinceName: address.province,
      countryCode: address.country,
      postalCode: address.postalCode,
    },
    returnWarehouseName: warehouse?.name,
    returnAddress: warehouse?.address,
    packageType: parcel.packageType,
    weightKg: parcel.weightKg,
    lengthCm: parcel.lengthCm,
    widthCm: parcel.widthCm,
    heightCm: parcel.heightCm,
    dimWeightKg: parcel.dimWeightKg,
    fragile: parcel.fragile,
    rotatable: parcel.rotatable,
    contents: parcelView(s, parcel).contents,
  });
}
