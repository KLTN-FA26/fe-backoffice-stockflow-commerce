import type { VehicleType } from "../types";

export const VT_20DC_ID = "00000000-0000-4000-8000-0000000f1000";

/** Dòng BE `VehicleTypeResponse` — 20DC mặc định (số liệu migration BE PR #153). */
export function apiVehicleType(overrides: Partial<VehicleType> = {}): VehicleType {
  return {
    vehicleTypeId: VT_20DC_ID,
    code: "20DC",
    name: "Container 20' Dry (20DC)",
    kind: "CONTAINER",
    innerLengthMm: 5898,
    innerWidthMm: 2352,
    innerHeightMm: 2393,
    gussetMm: 100,
    maxPayloadKg: 28200,
    availableCount: 10,
    preset: true,
    status: "ACTIVE",
    version: 0,
    ...overrides,
  };
}

/** Xe tải do người dùng tự thêm (không phải mặc định, có giá thuê). */
export function apiCustomTruck(overrides: Partial<VehicleType> = {}): VehicleType {
  return apiVehicleType({
    vehicleTypeId: "00000000-0000-4000-8000-0000000f2000",
    code: "TRUCK-3T",
    name: "Xe tải 3 tấn",
    kind: "TRUCK",
    innerLengthMm: 4200,
    innerWidthMm: 1900,
    innerHeightMm: 1900,
    gussetMm: 0,
    maxPayloadKg: 3000,
    availableCount: 2,
    rentalPrice: 1500000,
    preset: false,
    ...overrides,
  });
}
