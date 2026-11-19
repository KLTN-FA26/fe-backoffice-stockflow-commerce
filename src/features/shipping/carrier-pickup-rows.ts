/**
 * Shipping — bảng điểm lấy hàng của hãng theo kho (BE `CarrierPickupPoints`): mỗi kho một điểm, địa chỉ ≤ 500 (như hãng đọc),
 * người liên hệ ≤ 120, điện thoại ≤ 32, tối đa 200 dòng. Pure.
 */

import type { PickupPointBody, PickupPointRecord } from "./carrier-config-schemas";

import {
  REQUIRED,
  ROW_LIMITS as L,
  ROW_MESSAGES as MSG,
  codeError,
  isBlank,
  newRowKey,
} from "./carrier-row-core";

import type { RowErrors } from "./carrier-row-core";

export interface PickupPointRow {
  key: string;
  warehouseId: string;
  provinceCode: string;
  address: string;
  contactName: string;
  contactPhone: string;
}
type PickupField = "warehouseId" | "provinceCode" | "address" | "contactName" | "contactPhone";

export function pickupPointRowsFrom(records: readonly PickupPointRecord[]): PickupPointRow[] {
  return records.map((record) => ({
    key: newRowKey(),
    warehouseId: record.warehouseId,
    provinceCode: record.provinceCode,
    address: record.address,
    contactName: record.contactName ?? "",
    contactPhone: record.contactPhone ?? "",
  }));
}

export const emptyPickupPointRow = (): PickupPointRow => ({
  key: newRowKey(),
  warehouseId: "",
  provinceCode: "",
  address: "",
  contactName: "",
  contactPhone: "",
});

const pickupStarted = (row: PickupPointRow) =>
  !(
    row.warehouseId === "" &&
    isBlank(row.provinceCode) &&
    isBlank(row.address) &&
    isBlank(row.contactName) &&
    isBlank(row.contactPhone)
  );

export function validatePickupPointRows(rows: readonly PickupPointRow[]): RowErrors<PickupField>[] {
  const seen = new Set<string>();
  const used = rows.filter(pickupStarted).length;
  return rows.map((row) => {
    const errors: RowErrors<PickupField> = {};
    if (!pickupStarted(row)) return errors;
    if (row.warehouseId === "") errors.warehouseId = REQUIRED;
    else {
      if (seen.has(row.warehouseId)) errors.warehouseId = MSG.pickupWarehouseDuplicate;
      seen.add(row.warehouseId);
    }
    const province = codeError(row.provinceCode, L.provinceCodeMax);
    if (province) errors.provinceCode = province;
    const address = row.address.trim();
    if (address === "") errors.address = REQUIRED;
    else if (address.length > L.pickupAddressMax) errors.address = MSG.tooLong;
    if (row.contactName.trim().length > L.pickupContactNameMax) errors.contactName = MSG.tooLong;
    if (row.contactPhone.trim().length > L.pickupContactPhoneMax) errors.contactPhone = MSG.tooLong;
    if (used > L.pickupPointMaxRows) errors.address ??= MSG.tooManyRows(L.pickupPointMaxRows);
    return errors;
  });
}

export function pickupPointBodies(rows: readonly PickupPointRow[]): PickupPointBody[] {
  return rows.filter(pickupStarted).map((row) => ({
    warehouseId: row.warehouseId,
    provinceCode: row.provinceCode.trim(),
    address: row.address.trim(),
    contactName: row.contactName.trim() || undefined,
    contactPhone: row.contactPhone.trim() || undefined,
  }));
}

export const pickupPointSignature = (rows: readonly PickupPointRow[]): string =>
  JSON.stringify(
    pickupPointBodies(rows)
      .map((b) => [
        b.warehouseId,
        b.provinceCode,
        b.address,
        b.contactName ?? "",
        b.contactPhone ?? "",
      ])
      .sort(),
  );
