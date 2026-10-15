/**
 * Store in-memory cho mock chuyến xe (contract đề xuất SCRUM-288), chỉ dùng khi USE_MOCK=true.
 *
 * Kiện, đơn hàng và hãng lấy từ mock-data (`packingTasks[].packages`, `carriers`). Mock-data chưa
 * có chuyến xe / xe đặt nên ghép kiện thành chuyến ở đây, phủ đủ mọi `LoadStatus`.
 * ASSUMPTION (SCRUM-287/452 chưa có): biển số + loại xe là dữ liệu demo, không phải xe thật.
 */

import { beError } from "./mock-routes-purchase-orders-store";

export type MockLoadStatus = "PLANNED" | "VEHICLE_BOOKED" | "LOADING" | "DISPATCHED" | "CANCELLED";

export interface MockLoadLine {
  loadLineId: string;
  packageId: string;
  packageCode: string;
  orderId: string;
  orderNumber: string;
  weightKg: number;
  loadedAt: string | null;
  loadedBy: string | null;
}

export interface MockLoad {
  loadId: string;
  number: string;
  warehouseId: string;
  status: MockLoadStatus;
  vehiclePlate: string | null;
  vehicleType: string | null;
  carrierName: string | null;
  bookedAt: string | null;
  dispatchedAt: string | null;
  lines: MockLoadLine[];
  manifest: {
    manifestNumber: string;
    carrierRepresentative: string;
    note: string | null;
    handedOverBy: string | null;
    handedOverAt: string;
  } | null;
  version: number;
}

export const MOCK_LOADER = "mock-dispatch-staff";

/** Trạng thái task đóng gói (mock-data) coi là kiện sẵn sàng xếp xe. */
const PACKED_STATUSES: readonly string[] = ["Packed", "Handed to Shipping"];

/** Kế hoạch ghép kiện: [trạng thái, số kiện, số kiện đã lên xe, hãng (index), xe]. */
const PLAN: [MockLoadStatus, number, number, number, string | null, string | null][] = [
  ["LOADING", 3, 1, 0, "51C-628.14", "Xe tải 1,5 tấn"],
  ["VEHICLE_BOOKED", 2, 0, 1, "29H-310.52", "Xe tải 1 tấn"],
  ["LOADING", 1, 1, 2, "43C-117.09", "Xe van 750 kg"],
  ["DISPATCHED", 1, 1, 3, "51D-904.33", "Xe tải 2,5 tấn"],
  ["PLANNED", 1, 0, 0, null, null],
  ["CANCELLED", 1, 0, 1, null, null],
];

let store: Promise<Map<string, MockLoad>> | null = null;
let knownPackageCodes: Set<string> = new Set();

/** Cache promise (không cache kết quả): hai request đầu chạy song song dùng chung một store. */
export function getLoadStore(): Promise<Map<string, MockLoad>> {
  store ??= buildLoadStore();
  return store;
}

async function buildLoadStore(): Promise<Map<string, MockLoad>> {
  const { packingTasks, carriers } = await import("@/lib/mock-data");
  const all = packingTasks.flatMap((task) =>
    task.packages.map((pkg) => ({
      ...pkg,
      warehouseId: task.warehouseId,
      taskStatus: task.status,
    })),
  );
  // Mã kiện bất kỳ trong mock-data → "kiện không thuộc chuyến"; mã lạ → "không tìm thấy kiện"
  knownPackageCodes = new Set(all.map((p) => p.packageNo.toUpperCase()));
  // F-SHP bước 01: chỉ kiện đã đóng gói xong mới lên chuyến; một chuyến = một xe của MỘT kho
  const byWarehouse = new Map<string, typeof all>();
  for (const pkg of all) {
    if (!PACKED_STATUSES.includes(pkg.taskStatus)) continue;
    byWarehouse.set(pkg.warehouseId, [...(byWarehouse.get(pkg.warehouseId) ?? []), pkg]);
  }
  const takeChunk = (count: number) => {
    for (const [warehouseId, pool] of byWarehouse) {
      if (pool.length >= count) {
        byWarehouse.set(warehouseId, pool.slice(count));
        return pool.slice(0, count);
      }
    }
    return [];
  };
  const loads = new Map<string, MockLoad>();
  PLAN.forEach(([status, count, loaded, carrierIndex, plate, type], index) => {
    const chunk = takeChunk(count);
    const first = chunk[0];
    if (!first) return;
    const bookedAt = plate ? `2026-10-${String(10 + index).padStart(2, "0")}T07:30:00+07:00` : null;
    const lines = chunk.map((pkg, i) => ({
      loadLineId: `${pkg.packageId}-L`,
      packageId: pkg.packageId,
      packageCode: pkg.packageNo,
      orderId: pkg.orderId,
      // mock-data: orderId trùng orderNumber
      orderNumber: pkg.orderId,
      weightKg: pkg.weightKg,
      loadedAt:
        i < loaded && bookedAt ? bookedAt.replace("07:30", `08:${String(10 + i * 5)}`) : null,
      loadedBy: i < loaded ? MOCK_LOADER : null,
    }));
    const number = `LOAD-2026-${String(index + 1).padStart(4, "0")}`;
    const dispatched =
      status === "DISPATCHED" && bookedAt ? bookedAt.replace("07:30", "09:00") : null;
    loads.set(number, {
      loadId: number,
      number,
      warehouseId: first.warehouseId,
      status,
      vehiclePlate: plate,
      vehicleType: type,
      carrierName: carriers[carrierIndex]?.name ?? null,
      bookedAt,
      dispatchedAt: dispatched,
      lines,
      manifest: dispatched
        ? {
            manifestNumber: `MNF-${number.slice(5)}`,
            carrierRepresentative: "Đại diện hãng (demo)",
            note: null,
            handedOverBy: MOCK_LOADER,
            handedOverAt: dispatched,
          }
        : null,
      version: 0,
    });
  });
  return loads;
}

export function isKnownPackageCode(code: string): boolean {
  return knownPackageCodes.has(code.toUpperCase());
}

export function resetLoadMockStore(): void {
  store = null;
}

export function toLoadResponse(load: MockLoad) {
  return {
    ...load,
    plannedPackages: load.lines.length,
    loadedPackages: load.lines.filter((line) => line.loadedAt).length,
  };
}

export const loadNotFound = (id: string) => beError(404, "LOAD_NOT_FOUND", `Load ${id} not found`);

export const invalidLoadTransition = (from: string, action: string) =>
  beError(409, "INVALID_LOAD_TRANSITION", `Load in ${from} cannot ${action}`);
