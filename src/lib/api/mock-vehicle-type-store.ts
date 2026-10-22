/**
 * Store in-memory cho mock danh mục loại xe (BE PR #153, migration `V20261022000700`). Mười loại xe mặc định
 * lấy đúng số liệu của migration: bốn container ISO 668 (20DC, 40DC, 40HC, 45HC) và xe bán tải + năm xe tải
 * thùng kín phổ biến — số xấp xỉ, quản lý kho chỉnh theo xe thực thuê. `availableCount` = 10, chưa có giá thuê.
 * Chỉ dùng khi USE_MOCK=true.
 */

export type MockVehicleKind = "CONTAINER" | "TRUCK" | "PICKUP";
export type MockVehicleStatus = "ACTIVE" | "INACTIVE";

export interface MockVehicleType {
  vehicleTypeId: string;
  code: string;
  name: string;
  kind: MockVehicleKind;
  innerLengthMm: number;
  innerWidthMm: number;
  innerHeightMm: number;
  gussetMm: number;
  maxPayloadKg: number;
  availableCount: number;
  rentalPrice: number | null;
  preset: boolean;
  status: MockVehicleStatus;
  version: number;
}

type PresetSpec = [
  code: string,
  name: string,
  kind: MockVehicleKind,
  lengthMm: number,
  widthMm: number,
  heightMm: number,
  gussetMm: number,
  maxPayloadKg: number,
];

/** code, tên, loại, D × R × C (mm), khe góc (mm), tải trọng (kg) — như migration của BE. */
const PRESETS: PresetSpec[] = [
  ["20DC", "Container 20' Dry (20DC)", "CONTAINER", 5898, 2352, 2393, 100, 28200],
  ["40DC", "Container 40' Dry (40DC)", "CONTAINER", 12032, 2352, 2393, 100, 26700],
  ["40HC", "Container 40' High Cube (40HC)", "CONTAINER", 12032, 2352, 2698, 100, 26500],
  ["45HC", "Container 45' High Cube (45HC)", "CONTAINER", 13556, 2352, 2698, 100, 27700],
  ["PICKUP", "Pickup truck (xe bán tải)", "PICKUP", 1500, 1500, 500, 0, 800],
  ["TRUCK-1T25", "Box truck 1.25 t (xe tải 1,25 tấn)", "TRUCK", 3100, 1600, 1600, 50, 1250],
  ["TRUCK-2T5", "Box truck 2.5 t (xe tải 2,5 tấn)", "TRUCK", 4300, 1800, 1800, 50, 2500],
  ["TRUCK-5T", "Box truck 5 t (xe tải 5 tấn)", "TRUCK", 5200, 2050, 2050, 50, 5000],
  ["TRUCK-8T", "Box truck 8 t (xe tải 8 tấn)", "TRUCK", 6200, 2350, 2300, 50, 8000],
  ["TRUCK-15T", "Box truck 15 t (xe tải 15 tấn)", "TRUCK", 9300, 2350, 2400, 50, 15000],
];

/** Số xe sẵn có của loại xe mặc định (migration: 10). */
const PRESET_AVAILABLE_COUNT = 10;

function seed(): Map<string, MockVehicleType> {
  const rows = PRESETS.map(
    ([code, name, kind, innerLengthMm, innerWidthMm, innerHeightMm, gussetMm, maxPayloadKg], i) =>
      ({
        vehicleTypeId: `00000000-0000-4000-8000-0000000f1${String(i).padStart(3, "0")}`,
        code,
        name,
        kind,
        innerLengthMm,
        innerWidthMm,
        innerHeightMm,
        gussetMm,
        maxPayloadKg,
        availableCount: PRESET_AVAILABLE_COUNT,
        rentalPrice: null,
        preset: true,
        status: "ACTIVE",
        version: 0,
      }) satisfies MockVehicleType,
  );
  return new Map(rows.map((row) => [row.vehicleTypeId, row]));
}

let store: Map<string, MockVehicleType> | null = null;

export function getVehicleTypeStore(): Map<string, MockVehicleType> {
  store ??= seed();
  return store;
}

export function resetVehicleTypeMockStore(): void {
  store = null;
}

/** Mã loại xe mới sinh ra trong phiên mock (UUID dạng cố định, tăng dần). */
export function nextVehicleTypeId(): string {
  return `00000000-0000-4000-8000-0000000f2${String(getVehicleTypeStore().size).padStart(3, "0")}`;
}
