/**
 * Mock giao hàng cho hãng — dựng response đúng hình dạng BE (`LoadRowResponse`, `LoadResponse`,
 * `ManifestResponse`, `ShipmentRowResponse`, `ShipmentResponse`, `CarrierResponse`). Trường null được
 * `ok()` bỏ khỏi JSON như Jackson `non_null`.
 */

import {
  ftlDetailFields,
  ftlManifestFields,
  ftlRowFields,
  modeOf,
  parcelExtras,
  parcelsOn,
} from "./mock-dispatch-ftl-view";
import { codTotalOf } from "./mock-dispatch-store";

import type {
  DispatchState,
  MockCarrier,
  MockLoad,
  MockParcel,
  MockShipment,
} from "./mock-dispatch-store";

const CURRENCY = "VND";
const round = (value: number) => Math.round(value * 100) / 100;

export const carrierView = (carrier: MockCarrier) => ({
  carrierId: carrier.carrierId,
  code: carrier.code,
  name: carrier.name,
  contactName: carrier.contactName,
  contactPhone: carrier.contactPhone,
  status: carrier.status,
  version: carrier.version,
});

const carrierOf = (state: DispatchState, id: string | null) =>
  state.carriers.find((c) => c.carrierId === id);

/* ── Lô giao ─────────────────────────────────────────────────────────── */

export function shipmentRowView(state: DispatchState, shipment: MockShipment) {
  const load = shipment.loadId ? state.loads.get(shipment.loadId) : undefined;
  return {
    shipmentId: shipment.shipmentId,
    code: shipment.code,
    orderId: shipment.orderId,
    orderNumber: shipment.orderNumber,
    taskId: shipment.taskId,
    currency: CURRENCY,
    warehouseId: shipment.warehouseId,
    status: shipment.status,
    deliveryMode: load?.ftl ? "FULL_TRUCKLOAD" : "PARCEL",
    packageCount: shipment.parcels.length,
    // Số hãng thu: của nhãn tới khi bàn giao chốt (docs 09 BR-04)
    codAmount:
      shipment.status === "READY_TO_DISPATCH" ? shipment.labelCodAmount : shipment.codAmount,
    carrierId: shipment.carrierId,
    carrierName: carrierOf(state, shipment.carrierId)?.name,
    loadId: load?.loadId,
    loadCode: load?.code,
    partial: false,
    readyAt: shipment.readyAt,
    handedOverAt: shipment.handedOverAt,
    outcomeAt: shipment.outcomeAt,
    failureReason: shipment.failureReason,
    wholeOrderHandover: false,
    version: shipment.version,
  };
}

export function shipmentDetailView(state: DispatchState, shipment: MockShipment) {
  return {
    shipment: shipmentRowView(state, shipment),
    failureNote: shipment.failureNote,
    packages: shipment.parcels.map((parcel) => ({
      packageId: parcel.packageId,
      labelCode: parcel.labelCode,
      status: "SEALED",
      ...parcelExtras(parcel),
      weightKg: parcel.weightKg,
      lengthCm: parcel.lengthCm,
      widthCm: parcel.widthCm,
      heightCm: parcel.heightCm,
    })),
    timeline: shipment.timeline.map((step) => ({
      status: step.status,
      occurredAt: step.occurredAt,
      recordedByName: step.recordedByName,
      note: step.note,
    })),
  };
}

/* ── Chuyến xe ───────────────────────────────────────────────────────── */

const membersOf = (state: DispatchState, load: MockLoad): MockShipment[] =>
  load.shipmentIds.map((id) => state.shipments.get(id)).filter((s): s is MockShipment => !!s);

const loadedCount = (load: MockLoad, shipment: MockShipment) =>
  parcelsOn(load, shipment).filter((parcel) => load.loaded.has(parcel.packageId)).length;

export function loadRowView(state: DispatchState, load: MockLoad) {
  const members = membersOf(state, load);
  const carrier = carrierOf(state, load.carrierId);
  return {
    loadId: load.loadId,
    code: load.code,
    warehouseId: load.warehouseId,
    mode: modeOf(load),
    status: load.status,
    carrierId: load.carrierId,
    carrierName: carrier?.name,
    vehiclePlate: load.vehiclePlate,
    driverName: load.driverName,
    shipmentCount: members.length,
    packageCount: members.reduce((sum, s) => sum + loadedCount(load, s), 0),
    codTotal: codTotalOf(state, load),
    loadingStartedAt: load.loadingStartedAt,
    dispatchedAt: load.dispatchedAt,
    version: load.version,
    ...ftlRowFields(load),
  };
}

export function loadDetailView(state: DispatchState, load: MockLoad) {
  const members = membersOf(state, load);
  const carrier = carrierOf(state, load.carrierId);
  const expected = members.reduce((sum, s) => sum + parcelsOn(load, s).length, 0);
  const loaded = members.reduce((sum, s) => sum + loadedCount(load, s), 0);
  return {
    loadId: load.loadId,
    code: load.code,
    warehouseId: load.warehouseId,
    mode: modeOf(load),
    status: load.status,
    carrierId: load.carrierId,
    carrierCode: carrier?.code,
    carrierName: carrier?.name,
    vehiclePlate: load.vehiclePlate,
    driverName: load.driverName,
    driverPhone: load.driverPhone,
    loadingStartedAt: load.loadingStartedAt,
    dispatchedAt: load.dispatchedAt,
    dispatchedByName: load.dispatchedAt ? "Nhân viên kho (mock)" : null,
    carrierRepresentative: load.carrierRepresentative,
    signatureRef: load.signatureRef,
    handoverNote: load.handoverNote,
    cancelledAt: load.cancelledAt,
    cancelReason: load.cancelReason,
    shipmentCount: members.length,
    expectedPackageCount: expected,
    loadedPackageCount: loaded,
    codTotal: codTotalOf(state, load),
    currency: CURRENCY,
    version: load.version,
    ...ftlDetailFields(load),
    shipments: members.map((shipment) => ({
      // Lệnh chuyển kho (BE PR #164): không có lô giao / đơn / task, `code` là số lệnh, chỉ có `transferOrderId`
      shipmentId: shipment.transferOrderId ? undefined : shipment.shipmentId,
      code: shipment.code,
      orderId: shipment.transferOrderId ? undefined : shipment.orderId,
      orderNumber: shipment.transferOrderId ? undefined : shipment.orderNumber,
      taskId: shipment.transferOrderId ? undefined : shipment.taskId,
      transferOrderId: shipment.transferOrderId,
      currency: CURRENCY,
      status: shipment.status,
      packageCount: parcelsOn(load, shipment).length,
      loadedCount: loadedCount(load, shipment),
      labelCodAmount: shipment.labelCodAmount,
      codAmount: load.status === "DISPATCHED" ? shipment.codAmount : null,
      packages: parcelsOn(load, shipment).map((parcel) => {
        const scan = load.loaded.get(parcel.packageId);
        return {
          ...parcelExtras(parcel),
          packageId: parcel.packageId,
          labelCode: parcel.labelCode,
          weightKg: parcel.weightKg,
          loaded: !!scan,
          loadedAt: scan?.loadedAt,
          loadedBy: scan?.loadedBy,
        };
      }),
    })),
  };
}

const parcelView = (load: MockLoad, parcel: MockParcel) => ({
  labelCode: parcel.labelCode,
  weightKg: parcel.weightKg,
  lengthCm: parcel.lengthCm,
  widthCm: parcel.widthCm,
  heightCm: parcel.heightCm,
  loaded: load.loaded.has(parcel.packageId),
  ...parcelExtras(parcel),
});

export function manifestView(state: DispatchState, load: MockLoad) {
  const members = membersOf(state, load);
  const carrier = carrierOf(state, load.carrierId);
  const warehouse = state.warehouseNames.get(load.warehouseId);
  const dispatched = load.status === "DISPATCHED";
  return {
    loadCode: load.code,
    status: load.status,
    warehouseName: warehouse?.name,
    warehouseAddress: warehouse?.address,
    carrierCode: carrier?.code,
    carrierName: carrier?.name,
    carrierContactName: carrier?.contactName,
    carrierContactPhone: carrier?.contactPhone,
    vehiclePlate: load.vehiclePlate,
    driverName: load.driverName,
    driverPhone: load.driverPhone,
    carrierRepresentative: load.carrierRepresentative,
    signatureRef: load.signatureRef,
    handoverNote: load.handoverNote,
    dispatchedAt: load.dispatchedAt,
    dispatchedByName: dispatched ? "Nhân viên kho (mock)" : null,
    shipments: members.map((shipment) => ({
      shipmentCode: shipment.code,
      orderNumber: shipment.transferOrderId ? undefined : shipment.orderNumber,
      transferOrderId: shipment.transferOrderId,
      recipientName: shipment.recipient.name,
      recipientPhone: shipment.recipient.phone,
      deliveryAddress: shipment.recipient.address,
      packageCount: parcelsOn(load, shipment).length,
      weightKg: round(parcelsOn(load, shipment).reduce((sum, p) => sum + p.weightKg, 0)),
      codAmount: dispatched ? shipment.codAmount : shipment.labelCodAmount,
      codChangedSinceLabel: dispatched && shipment.codAmount !== shipment.labelCodAmount,
      packages: parcelsOn(load, shipment).map((parcel) => parcelView(load, parcel)),
    })),
    shipmentCount: members.length,
    packageCount: members.reduce((sum, s) => sum + parcelsOn(load, s).length, 0),
    totalWeightKg: round(
      members.reduce((sum, s) => sum + parcelsOn(load, s).reduce((w, p) => w + p.weightKg, 0), 0),
    ),
    codTotal: codTotalOf(state, load),
    currency: CURRENCY,
    printedAt: new Date().toISOString(),
    ...ftlManifestFields(load),
  };
}
