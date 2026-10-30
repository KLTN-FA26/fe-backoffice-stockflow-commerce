/**
 * Store in-memory cho mock module 06 (danh mục kho + bản đồ kho), dạng dữ liệu của BE
 * (`warehouse.warehouse` / `zone` / `shelf` / `shelf_level` / `bin` / `area` / `boundary`).
 * Seed = đúng seed demo BE `db/demo/V20260928009000__demo_master_data.sql` §4 (kho HCM 60 × 40 m, 2 zone,
 * 3 kệ × 2 tầng × 2 bin, 5 khu vực, 1 tường + 1 cửa) — không tự bịa số liệu. Chỉ dùng khi USE_MOCK=true.
 */

import { MOCK_WAREHOUSE_ID } from "./mock-routes-goods-receipts-store";

export type MockLocationStatus = "ACTIVE" | "BLOCKED" | "MAINTENANCE" | "INACTIVE";

export interface MockFootprint {
  x: number;
  y: number;
  width: number;
  length: number;
  rotation: number;
}

export interface MockWarehouse {
  id: string;
  prefix: string;
  name: string;
  address: string;
  returnAddress: string | null;
  mapUnit: "M";
  mapWidth: number;
  mapHeight: number;
  status: "ACTIVE" | "INACTIVE";
  version: number;
  createdAt: string;
}

export interface MockStorageLocation {
  locationId: string;
  locationCode: string;
  storageClass: string;
  capacityUnits: number | null;
  maxWeight: number | null;
  pickable: boolean;
  putawayTarget: boolean;
}

export interface MockBin extends MockStorageLocation {
  id: string;
  code: string;
  description: string | null;
  footprint: MockFootprint;
  type: string;
  storageClassOverride: string | null;
  status: MockLocationStatus;
}

export interface MockLevel {
  id: string;
  levelIndex: number;
  elevation: number | null;
  usableHeight: number | null;
  maxWeight: number | null;
  bins: MockBin[];
}

export interface MockShelf {
  id: string;
  warehouseId: string;
  zoneId: string | null;
  code: string;
  name: string;
  description: string | null;
  footprint: MockFootprint;
  obstacle: boolean;
  pickFaces: { north: boolean; east: boolean; south: boolean; west: boolean };
  defaultStorageClass: string;
  status: MockLocationStatus;
  version: number;
  levels: MockLevel[];
}

export interface MockArea {
  id: string;
  warehouseId: string;
  code: string;
  type: string;
  name: string;
  footprint: MockFootprint;
  obstacle: boolean;
  status: MockLocationStatus;
  version: number;
  /** `null` = khu NON_STORAGE, không phải vị trí tồn kho (docs 06 BR-11). */
  location: MockStorageLocation | null;
}

export interface MockZone {
  id: string;
  warehouseId: string;
  name: string;
  color: string | null;
  version: number;
}

export interface MockBoundary {
  id: string;
  warehouseId: string;
  type: "WALL" | "DOOR";
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  passable: boolean;
  operationalStatus: "OPEN" | "CLOSED" | null;
  version: number;
}

export interface MockWarehouseStore {
  warehouses: Map<string, MockWarehouse>;
  zones: MockZone[];
  shelves: MockShelf[];
  areas: MockArea[];
  boundaries: MockBoundary[];
  /** Mã vị trí đang có dòng tồn — chỉ để biết vị trí còn hàng (BR-04), không mô phỏng số lượng. */
  stockedLocations: Set<string>;
}

const fp = (x: number, y: number, width: number, length: number): MockFootprint => ({
  x,
  y,
  width,
  length,
  rotation: 0,
});

/** Seed BE §4: kệ A01 / A02 (zone A, OVERSIZE), B01 (zone B, NORMAL); tầng 1–2; bin A (x 0), B (x 5). */
function seedShelf(code: string, zone: string, y: number, storageClass: string): MockShelf {
  const levels = [1, 2].map((levelIndex) => ({
    id: `mock-level-HCM-${code}-${levelIndex}`,
    levelIndex,
    elevation: (levelIndex - 1) * 1.5,
    usableHeight: 1.4,
    maxWeight: 500,
    bins: (["A", "B"] as const).map((binCode, i) => ({
      id: `mock-bin-HCM-${code}-${levelIndex}-${binCode}`,
      code: binCode,
      description: null,
      footprint: fp(i * 5, 0, 5, 1.2),
      type: "PALLET",
      storageClassOverride: null,
      locationId: `mock-loc-HCM-${code}-${levelIndex}-${binCode}`,
      locationCode: `HCM-${code}-${levelIndex}-${binCode}`,
      storageClass,
      capacityUnits: 40,
      maxWeight: 250,
      pickable: true,
      putawayTarget: true,
      status: "ACTIVE" as const,
    })),
  }));
  return {
    id: `mock-shelf-HCM-${code}`,
    warehouseId: MOCK_WAREHOUSE_ID,
    zoneId: `mock-zone-HCM-${zone}`,
    code,
    name: `Kệ ${code}`,
    description: null,
    footprint: fp(5, y, 10, 1.2),
    obstacle: true,
    pickFaces: { north: false, east: false, south: true, west: false },
    defaultStorageClass: storageClass,
    status: "ACTIVE",
    version: 0,
    levels,
  };
}

function seedArea(code: string, type: string, name: string, box: MockFootprint): MockArea {
  const storage = type !== "NON_STORAGE";
  return {
    id: `mock-area-HCM-${code}`,
    warehouseId: MOCK_WAREHOUSE_ID,
    code,
    type,
    name,
    footprint: box,
    obstacle: !storage,
    status: "ACTIVE",
    version: 0,
    location: storage
      ? {
          locationId: `mock-loc-HCM-${code}`,
          locationCode: `HCM-${code}`,
          storageClass: "OVERSIZE",
          capacityUnits: null,
          maxWeight: null,
          pickable: false,
          putawayTarget: false,
        }
      : null,
  };
}

function seed(): MockWarehouseStore {
  const hcm: MockWarehouse = {
    id: MOCK_WAREHOUSE_ID,
    prefix: "HCM",
    name: "Kho Hồ Chí Minh",
    address: "12 Đường Demo, Phường Tân Thuận, TP. Hồ Chí Minh",
    returnAddress: null,
    mapUnit: "M",
    mapWidth: 60,
    mapHeight: 40,
    status: "ACTIVE",
    version: 0,
    createdAt: "2026-09-28T00:00:00Z",
  };
  const zone = (key: string, name: string, color: string): MockZone => ({
    id: `mock-zone-HCM-${key}`,
    warehouseId: MOCK_WAREHOUSE_ID,
    name,
    color,
    version: 0,
  });
  return {
    warehouses: new Map([[hcm.id, hcm]]),
    // Màu zone là DỮ LIỆU người dùng nhập (#RRGGBB) — chép nguyên từ seed BE
    zones: [zone("A", "Khu A - Sofa", "#4F81BD"), zone("B", "Khu B - Bàn", "#9BBB59")],
    shelves: [
      seedShelf("A01", "A", 5, "OVERSIZE"),
      seedShelf("A02", "A", 9, "OVERSIZE"),
      seedShelf("B01", "B", 14, "NORMAL"),
    ],
    areas: [
      seedArea("RCV01", "RECEIVING", "Khu nhận hàng", fp(40, 2, 15, 8)),
      seedArea("QC01", "QUARANTINE", "Khu cách ly QC", fp(40, 12, 8, 6)),
      seedArea("PACK01", "PACKING", "Khu đóng gói", fp(40, 20, 10, 6)),
      seedArea("DSP01", "DISPATCH", "Khu chờ giao", fp(40, 28, 10, 6)),
      seedArea("OFFICE", "NON_STORAGE", "Văn phòng kho", fp(2, 30, 10, 8)),
    ],
    boundaries: [
      {
        id: "mock-wall-HCM-N",
        warehouseId: MOCK_WAREHOUSE_ID,
        type: "WALL",
        startX: 0,
        startY: 0,
        endX: 60,
        endY: 0,
        passable: false,
        operationalStatus: null,
        version: 0,
      },
      {
        id: "mock-door-HCM-E",
        warehouseId: MOCK_WAREHOUSE_ID,
        type: "DOOR",
        startX: 60,
        startY: 2,
        endX: 60,
        endY: 8,
        passable: true,
        operationalStatus: "OPEN",
        version: 0,
      },
    ],
    // Seed BE §5: tồn demo được dời vào đúng các vị trí này của bản đồ
    stockedLocations: new Set(["HCM-A01-2-B", "HCM-A02-1-A", "HCM-B01-1-A", "HCM-QC01"]),
  };
}

let store: MockWarehouseStore | null = null;

export function getWarehouseStore(): MockWarehouseStore {
  store ??= seed();
  return store;
}

export function resetWarehouseMockStore(): void {
  store = null;
}

/** Trạng thái hiệu lực = hẹp nhất (docs 06 §4.2, BR-16): Inactive > Maintenance > Blocked > Active. */
const NARROWNESS: readonly MockLocationStatus[] = ["ACTIVE", "BLOCKED", "MAINTENANCE", "INACTIVE"];

export function narrowest(...statuses: MockLocationStatus[]): MockLocationStatus {
  return statuses.reduce((a, b) => (NARROWNESS.indexOf(b) > NARROWNESS.indexOf(a) ? b : a));
}
