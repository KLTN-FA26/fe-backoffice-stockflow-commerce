/**
 * Fixture đúng hình dạng response BE `CartonCheckController` (4C-6, docs 08): hàng chờ + phiên kiểm thùng. Field chưa có
 * giá trị được BỎ khỏi object (Jackson non_null) chứ không gán null.
 */

import { ORDER_ID, OTHER_PICKER_ID, PICKER_ID, TASK_ID, WAREHOUSE_ID } from "./task";

import type { CartonCheckQueueRowDto, CartonCheckSessionDto } from "../carton-check-types";

export const CARTON_CHECK_PATH = `/fulfillment/tasks/${TASK_ID}`;
export const QUEUE_PATH = "/fulfillment/packing-queue";
export const LINE_A_ID = "11111111-aaaa-4bbb-8ccc-000000000001";
export const LINE_B_ID = "33333333-aaaa-4bbb-8ccc-000000000003";
export { OTHER_PICKER_ID as OTHER_STARTER_ID, PICKER_ID as STARTER_ID };

export type ApiCarton = CartonCheckSessionDto["cartons"][number];

/** Thùng của BE: mặc định To Check, chưa quét (chưa có `packageId` trước khi phiên bắt đầu). */
export function apiCarton(overrides: Partial<ApiCarton> = {}): ApiCarton {
  return {
    packageId: "p-1",
    packageNo: 1,
    labelCode: "SO-20261010-000431-1",
    lpn: "LPN000001",
    pickLineId: "pl-1",
    orderLineId: LINE_A_ID,
    sku: "TEE-BLK-M",
    quantity: 10,
    status: "TO_CHECK",
    labelVersion: 0,
    rotatable: true,
    ...overrides,
  };
}

/** Thùng đã dán nhãn (version 1) theo quy cách thùng 40 × 30 × 25 cm, 6,5 kg. */
export const labeledCarton = (overrides: Partial<ApiCarton> = {}) =>
  apiCarton({
    status: "LABELED",
    checkedAt: "2026-10-10T03:00:00Z",
    labeledAt: "2026-10-10T03:05:00Z",
    labelVersion: 1,
    lengthCm: 40,
    widthCm: 30,
    heightCm: 25,
    weightKg: 6.5,
    dimWeightKg: 5,
    ...overrides,
  });

export const checkedCarton = (overrides: Partial<ApiCarton> = {}) =>
  apiCarton({ status: "CHECKED", checkedAt: "2026-10-10T03:00:00Z", ...overrides });

/** Hai thùng của hai dòng; phiên mới tạo (PENDING), chưa ai bắt đầu. */
export function apiSession(overrides: Partial<CartonCheckSessionDto> = {}): CartonCheckSessionDto {
  return {
    taskId: TASK_ID,
    orderId: ORDER_ID,
    orderNumber: "SO-20261010-000431",
    warehouseId: WAREHOUSE_ID,
    status: "PENDING",
    orderLocked: false,
    lines: [
      {
        orderLineId: LINE_A_ID,
        sku: "TEE-BLK-M",
        wantedUnits: 10,
        cartons: 1,
        checkedCartons: 0,
        labeledCartons: 0,
        removedCartons: 0,
        shippedCartons: 0,
        labeledUnits: 0,
        missingUnits: 10,
      },
      {
        orderLineId: LINE_B_ID,
        sku: "MUG-WHT-11",
        wantedUnits: 10,
        cartons: 1,
        checkedCartons: 0,
        labeledCartons: 0,
        removedCartons: 0,
        shippedCartons: 0,
        labeledUnits: 0,
        missingUnits: 10,
      },
    ],
    cartons: [
      apiCarton(),
      apiCarton({
        packageId: "p-2",
        packageNo: 2,
        lpn: "LPN000002",
        pickLineId: "pl-2",
        orderLineId: LINE_B_ID,
        sku: "MUG-WHT-11",
        labelCode: "SO-20261010-000431-2",
      }),
    ],
    shipments: [],
    skusWithoutCartonSpec: [],
    ...overrides,
  };
}

/** Phiên đang kiểm do `STARTER_ID` bắt đầu. */
export const startedSession = (overrides: Partial<CartonCheckSessionDto> = {}) =>
  apiSession({
    status: "IN_PROGRESS",
    startedBy: PICKER_ID,
    startedByName: "Hoàng Anh Tuấn",
    startedAt: "2026-10-10T02:30:00Z",
    ...overrides,
  });

/** Phiên đã quét + dán nhãn hết cả hai thùng (chưa vào shipment) — sẵn sàng hoàn tất đủ. */
export const allLabeledSession = () =>
  startedSession({
    orderLocked: true,
    lines: apiSession().lines.map((line) => ({
      ...line,
      checkedCartons: 1,
      labeledCartons: 1,
      labeledUnits: 10,
      missingUnits: 0,
    })),
    cartons: [
      labeledCarton(),
      labeledCarton({
        packageId: "p-2",
        packageNo: 2,
        lpn: "LPN000002",
        pickLineId: "pl-2",
        orderLineId: LINE_B_ID,
        sku: "MUG-WHT-11",
        labelCode: "SO-20261010-000431-2",
      }),
    ],
  });

export function queueRow(overrides: Partial<CartonCheckQueueRowDto> = {}): CartonCheckQueueRowDto {
  return {
    taskId: TASK_ID,
    orderId: ORDER_ID,
    orderNumber: "SO-20261010-000431",
    warehouseId: "wh-1",
    status: "PENDING",
    pickedAt: "2026-10-10T02:00:00Z",
    pickerName: "Hoàng Anh Tuấn",
    cartonCount: 0,
    checkedCount: 0,
    labeledCount: 0,
    shipmentCount: 0,
    ...overrides,
  };
}
