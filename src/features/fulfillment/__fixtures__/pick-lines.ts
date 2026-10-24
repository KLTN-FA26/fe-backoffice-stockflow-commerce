/**
 * Fixture đúng hình dạng BE `PickLineResponse` (SCRUM-267/275, `shortQty` từ BE PR #147). Field null bị BỎ khỏi
 * object (Jackson non_null) chứ không gán null; số nguyên (`putBackQty`, `shortQty`) luôn có.
 */

import { PLAIN_LINE_ID, TASK_ID } from "./task";

import type { PickLineApiDto } from "../types";

export const PICK_LINE_1 = "aaaa0001-1111-4222-8333-000000000001";
export const PICK_LINE_2 = "aaaa0002-1111-4222-8333-000000000002";
export const PICK_LINE_3 = "aaaa0003-1111-4222-8333-000000000003";

export function apiPickLine(overrides: Partial<PickLineApiDto> = {}): PickLineApiDto {
  return {
    lineId: PICK_LINE_1,
    taskId: TASK_ID,
    sequenceNo: 1,
    orderLineId: PLAIN_LINE_ID,
    sku: "TEE-BLK-M",
    barcode: "8935000000017",
    locationCode: "HN-A01-01-01-A",
    lotNumber: "L001",
    allocatedQty: 3,
    pickedQty: 0,
    status: "OPEN",
    putBackQty: 0,
    shortQty: 0,
    ...overrides,
  };
}

/** 3 dòng theo lộ trình: dòng 2 không có barcode / lô, dòng 3 ở vị trí khác. */
export function apiPickLines(): PickLineApiDto[] {
  const {
    barcode: _barcode,
    lotNumber: _lot,
    ...noBarcode
  } = apiPickLine({
    lineId: PICK_LINE_2,
    sequenceNo: 2,
    sku: "MUG-WHT",
    locationCode: "HN-A01-01-02-A",
    allocatedQty: 2,
  });
  return [
    apiPickLine(),
    noBarcode,
    apiPickLine({
      lineId: PICK_LINE_3,
      sequenceNo: 3,
      sku: "CAP-RED",
      barcode: "8935000000031",
      locationCode: "HN-A02-02-01-B",
      allocatedQty: 5,
    }),
  ];
}
