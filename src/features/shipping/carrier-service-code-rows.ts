/**
 * Shipping — bảng mã dịch vụ của hãng theo loại xe và tỉnh / thành (BE `CarrierServiceCodeService`): mỗi loại xe một mã mỗi
 * tỉnh, mã in được không khoảng trắng (tỉnh ≤ 20, thành phố của hãng ≤ 32, dịch vụ ≤ 64), tối đa 500 dòng. Pure.
 */

import type { ServiceCodeBody, ServiceCodeRecord } from "./carrier-config-schemas";

import {
  REQUIRED,
  ROW_LIMITS as L,
  ROW_MESSAGES as MSG,
  codeError,
  isBlank,
  newRowKey,
} from "./carrier-row-core";

import type { RowErrors } from "./carrier-row-core";

export interface ServiceCodeRow {
  key: string;
  vehicleTypeId: string;
  /** Mã loại xe BE trả kèm: chỉ để hiện khi danh mục loại xe chưa tải được. */
  vehicleTypeCode: string;
  provinceCode: string;
  carrierCityCode: string;
  serviceCode: string;
}
type ServiceField = "vehicleTypeId" | "provinceCode" | "carrierCityCode" | "serviceCode";

export function serviceCodeRowsFrom(records: readonly ServiceCodeRecord[]): ServiceCodeRow[] {
  return records.map((record) => ({
    key: newRowKey(),
    vehicleTypeId: record.vehicleTypeId,
    vehicleTypeCode: record.vehicleTypeCode ?? "",
    provinceCode: record.provinceCode,
    carrierCityCode: record.carrierCityCode,
    serviceCode: record.serviceCode,
  }));
}

export const emptyServiceCodeRow = (): ServiceCodeRow => ({
  key: newRowKey(),
  vehicleTypeId: "",
  vehicleTypeCode: "",
  provinceCode: "",
  carrierCityCode: "",
  serviceCode: "",
});

const serviceStarted = (row: ServiceCodeRow) =>
  !(
    row.vehicleTypeId === "" &&
    isBlank(row.provinceCode) &&
    isBlank(row.carrierCityCode) &&
    isBlank(row.serviceCode)
  );

export function validateServiceCodeRows(
  rows: readonly ServiceCodeRow[],
): RowErrors<ServiceField>[] {
  const seen = new Set<string>();
  const used = rows.filter(serviceStarted).length;
  return rows.map((row) => {
    const errors: RowErrors<ServiceField> = {};
    if (!serviceStarted(row)) return errors;
    if (row.vehicleTypeId === "") errors.vehicleTypeId = REQUIRED;
    const province = codeError(row.provinceCode, L.provinceCodeMax);
    if (province) errors.provinceCode = province;
    const city = codeError(row.carrierCityCode, L.carrierCityCodeMax);
    if (city) errors.carrierCityCode = city;
    const service = codeError(row.serviceCode, L.serviceCodeMax);
    if (service) errors.serviceCode = service;
    if (!errors.vehicleTypeId && !errors.provinceCode) {
      const key = `${row.vehicleTypeId}|${row.provinceCode.trim()}`;
      if (seen.has(key)) errors.provinceCode = MSG.serviceCodeDuplicate;
      seen.add(key);
    }
    if (used > L.serviceCodeMaxRows) errors.serviceCode ??= MSG.tooManyRows(L.serviceCodeMaxRows);
    return errors;
  });
}

export function serviceCodeBodies(rows: readonly ServiceCodeRow[]): ServiceCodeBody[] {
  return rows.filter(serviceStarted).map((row) => ({
    vehicleTypeId: row.vehicleTypeId,
    provinceCode: row.provinceCode.trim(),
    carrierCityCode: row.carrierCityCode.trim(),
    serviceCode: row.serviceCode.trim(),
  }));
}

export const serviceCodeSignature = (rows: readonly ServiceCodeRow[]): string =>
  JSON.stringify(
    serviceCodeBodies(rows)
      .map((b) => [b.vehicleTypeId, b.provinceCode, b.carrierCityCode, b.serviceCode])
      .sort(),
  );
