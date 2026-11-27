/**
 * Store mock cất hàng (docs 05), chỉ dùng khi USE_MOCK=true. Không bịa thùng: nhiệm vụ sinh từ thùng thật của mock —
 * thùng IN_STOCK đang ở khu RECEIVING trên phiếu nhập (BE `PutawayTaskCreator`, nguồn RECEIPT) và thùng Quản lý kho
 * giải phóng khỏi khu cách ly (`openMockReleaseTask`, nguồn QUARANTINE_RELEASE). Bin và sức chứa đọc từ store bản đồ kho
 * (`mock-warehouse-store`, đúng seed BE).
 */

import { PUTAWAY_SUGGESTION_REASONS } from "@/constants";

import {
  listMockCartons,
  listMockReleaseTasks,
  mockWarehouseCodeOf,
} from "./mock-inventory-cartons";
import { getReceiptStore, MOCK_AREAS } from "./mock-routes-goods-receipts-store";
import { getWarehouseStore } from "./mock-warehouse-store";

import type { MockCarton } from "./mock-inventory-cartons";

type Reason = (typeof PUTAWAY_SUGGESTION_REASONS)[number];

export interface MockPutawayTask {
  id: string;
  source: "RECEIPT" | "QUARANTINE_RELEASE";
  goodsReceiptId: string | null;
  goodsReceiptLineId: string | null;
  lpn: string;
  sku: string;
  lotNumber: string | null;
  quantity: number;
  status: "PENDING" | "IN_PROGRESS" | "DONE" | "CANCELLED";
  targetLocationCode: string | null;
}

export interface MockSuggestion {
  locationCode: string;
  reason: Reason;
  freeVolumeM3: number | null;
  freeWeightKg: number | null;
}

/**
 * ASSUMPTION (mock): mock-data không có quy cách thùng (`carton_spec`) — mọi thùng 0,6 × 0,4 × 0,4 m (0,096 m³) và
 * 1 kg mỗi cái. Đủ để demo bin đầy dần và lỗi vượt sức chứa; BE thật đọc kích thước / trọng lượng thùng.
 */
export const MOCK_CARTON_VOLUME_M3 = 0.096;
const MOCK_KG_PER_UNIT = 1;
const MAX_SUGGESTIONS = 10;

let tasks: Map<string, MockPutawayTask> | null = null;

export function resetPutawayMockStore(): void {
  tasks = null;
}

const upper = (value: string | null | undefined) => (value ?? "").trim().toUpperCase();
export const cartonWeight = (quantity: number) => quantity * MOCK_KG_PER_UNIT;

/** Đồng bộ nhiệm vụ với thùng hiện có — mở nhiệm vụ cho thùng mới, không mở trùng (docs 05 §4.1 bước 1). */
async function syncTasks(): Promise<Map<string, MockPutawayTask>> {
  tasks ??= new Map();
  const opened = new Set([...tasks.values()].map((task) => upper(task.lpn)));
  for (const receipt of (await getReceiptStore()).values()) {
    if (receipt.status !== "IN_PUTAWAY") continue;
    for (const line of receipt.lines) {
      for (const pkg of line.packages ?? []) {
        const inReceiving = pkg.locationCode && MOCK_AREAS[pkg.locationCode] === "RECEIVING";
        if (pkg.status !== "IN_STOCK" || !inReceiving || opened.has(upper(pkg.lpn))) continue;
        opened.add(upper(pkg.lpn));
        tasks.set(`pt-${pkg.id}`, {
          id: `pt-${pkg.id}`,
          source: "RECEIPT",
          goodsReceiptId: receipt.id,
          goodsReceiptLineId: line.id,
          lpn: pkg.lpn,
          sku: line.sku ?? "",
          lotNumber: line.lotNumber,
          quantity: pkg.quantity,
          status: "PENDING",
          targetLocationCode: null,
        });
      }
    }
  }
  const cartons = await listMockCartons();
  for (const release of listMockReleaseTasks()) {
    if (opened.has(upper(release.lpn))) continue;
    const carton = cartons.find((c) => upper(c.pkg.lpn) === upper(release.lpn));
    if (!carton) continue;
    opened.add(upper(release.lpn));
    tasks.set(release.id, {
      id: release.id,
      source: "QUARANTINE_RELEASE",
      goodsReceiptId: null,
      goodsReceiptLineId: null,
      lpn: carton.pkg.lpn,
      sku: carton.sku,
      lotNumber: carton.lotNumber,
      quantity: carton.pkg.quantity,
      status: "PENDING",
      targetLocationCode: null,
    });
  }
  return tasks;
}

export async function listPutawayTasks(): Promise<MockPutawayTask[]> {
  return [...(await syncTasks()).values()].sort((a, b) => a.id.localeCompare(b.id));
}

export async function findPutawayTask(id: string): Promise<MockPutawayTask | undefined> {
  return (await syncTasks()).get(id);
}

/** Thùng của nhiệm vụ — nơi nó đang đứng là `sourceLocationCode` (BE không lưu). */
export async function cartonOf(task: MockPutawayTask): Promise<MockCarton | undefined> {
  return (await listMockCartons()).find((carton) => upper(carton.pkg.lpn) === upper(task.lpn));
}

export interface MockBinPlace {
  locationCode: string;
  usable: boolean;
  putawayTarget: boolean;
  /** null = tầng chưa có chiều cao thông thuỷ → không giới hạn thể tích (docs 05 BR-03). */
  volumeM3: number | null;
  maxWeightKg: number | null;
}

/** Mọi bin của kho theo mã kho (đoạn đầu mã vị trí) — từ store bản đồ kho. */
export function binsOfWarehouse(warehouseCode: string): MockBinPlace[] {
  const store = getWarehouseStore();
  const warehouse = [...store.warehouses.values()].find(
    (w) => upper(w.prefix) === upper(warehouseCode),
  );
  if (!warehouse) return [];
  return store.shelves
    .filter((shelf) => shelf.warehouseId === warehouse.id)
    .flatMap((shelf) =>
      shelf.levels.flatMap((level) =>
        level.bins.map((bin) => ({
          locationCode: bin.locationCode,
          usable:
            warehouse.status === "ACTIVE" && shelf.status === "ACTIVE" && bin.status === "ACTIVE",
          putawayTarget: bin.putawayTarget,
          volumeM3:
            level.usableHeight == null
              ? null
              : bin.footprint.width * bin.footprint.length * level.usableHeight,
          maxWeightKg: bin.maxWeight,
        })),
      ),
    );
}

/** Khu của kho (mã vị trí + loại + dùng được) — để biết OVERFLOW và "không phải bin". */
export function areasOfWarehouse(warehouseCode: string) {
  const store = getWarehouseStore();
  const warehouse = [...store.warehouses.values()].find(
    (w) => upper(w.prefix) === upper(warehouseCode),
  );
  if (!warehouse) return [];
  return store.areas
    .filter((area) => area.warehouseId === warehouse.id && area.location)
    .map((area) => ({
      locationCode: area.location?.locationCode ?? "",
      type: area.type,
      usable: area.status === "ACTIVE",
    }));
}

/** Chỗ đang giữ ở một bin bởi chuyến cất hàng (BR-16) — store chuyến đăng ký nguồn này, tránh import vòng. */
export interface MockHeld {
  cartons: number;
  weightKg: number;
}
let heldAt: (locationCode: string) => MockHeld = () => ({ cartons: 0, weightKg: 0 });
export function registerHoldSource(source: (locationCode: string) => MockHeld): void {
  heldAt = source;
}

/** Chỗ còn trống của một bin: trừ thùng đang nằm trong bin và chỗ chuyến đang giữ (docs 05 BR-03, BR-16). */
export async function freeOf(bin: MockBinPlace) {
  const inside = (await listMockCartons()).filter(
    (c) => c.pkg.status === "IN_STOCK" && upper(c.pkg.locationCode) === upper(bin.locationCode),
  );
  const held = heldAt(bin.locationCode);
  const usedWeight =
    inside.reduce((sum, c) => sum + cartonWeight(c.pkg.quantity), 0) + held.weightKg;
  const usedCartons = inside.length + held.cartons;
  return {
    inside,
    freeVolumeM3: bin.volumeM3 == null ? null : bin.volumeM3 - usedCartons * MOCK_CARTON_VOLUME_M3,
    freeWeightKg: bin.maxWeightKg == null ? null : bin.maxWeightKg - usedWeight,
  };
}

/** Bin nhận được thùng không: còn đủ thể tích và tải (vắng giới hạn = không kiểm). */
export function takes(
  free: { freeVolumeM3: number | null; freeWeightKg: number | null },
  quantity: number,
) {
  const volumeOk = free.freeVolumeM3 == null || free.freeVolumeM3 >= MOCK_CARTON_VOLUME_M3;
  const weightOk = free.freeWeightKg == null || free.freeWeightKg >= cartonWeight(quantity);
  return volumeOk && weightOk;
}

function reasonOf(task: MockPutawayTask, inside: readonly MockCarton[]): Reason {
  if (inside.length === 0) return "EMPTY";
  const sameSku = inside.filter((c) => c.sku === task.sku);
  if (sameSku.some((c) => (c.lotNumber ?? "") === (task.lotNumber ?? ""))) return "SAME_LOT";
  return sameSku.length > 0 ? "SAME_SKU" : "OTHER_SKU";
}

/**
 * BE `PutawayRanker` (docs 05 §4.3, BR-04, BR-05): lọc bin dùng được, cho phép cất, còn chỗ; bin có thể tích trước bin
 * không có; nhóm SAME_LOT → EMPTY → SAME_SKU → OTHER_SKU; trong nhóm bin còn ít chỗ nhất trước (vừa khít); hoà thì
 * theo mã. ASSUMPTION (mock): nhóm EMPTY cũng xếp vừa khít — mock không tính "phần còn lại của lô".
 */
export async function suggestionsFor(
  task: MockPutawayTask,
  fromLocation: string,
): Promise<MockSuggestion[]> {
  const ranked: (MockSuggestion & { known: boolean })[] = [];
  for (const bin of binsOfWarehouse(mockWarehouseCodeOf(fromLocation))) {
    if (!bin.usable || !bin.putawayTarget) continue;
    const free = await freeOf(bin);
    if (!takes(free, task.quantity)) continue;
    ranked.push({
      locationCode: bin.locationCode,
      reason: reasonOf(task, free.inside),
      freeVolumeM3: free.freeVolumeM3 == null ? null : Number(free.freeVolumeM3.toFixed(3)),
      freeWeightKg: free.freeWeightKg,
      known: free.freeVolumeM3 != null,
    });
  }
  const group = (reason: Reason) => PUTAWAY_SUGGESTION_REASONS.indexOf(reason);
  ranked.sort(
    (a, b) =>
      Number(b.known) - Number(a.known) ||
      group(a.reason) - group(b.reason) ||
      (a.freeVolumeM3 ?? 0) - (b.freeVolumeM3 ?? 0) ||
      a.locationCode.localeCompare(b.locationCode),
  );
  return ranked.slice(0, MAX_SUGGESTIONS).map((s) => ({
    locationCode: s.locationCode,
    reason: s.reason,
    freeVolumeM3: s.freeVolumeM3,
    freeWeightKg: s.freeWeightKg,
  }));
}

/** Thùng cuối của phiếu được cất → phiếu In Putaway → Closed (docs 05 §4.4 bước 9). */
export async function closeReceiptIfDone(goodsReceiptId: string | null): Promise<void> {
  if (!goodsReceiptId) return;
  const receipt = (await getReceiptStore()).get(goodsReceiptId);
  if (!receipt || receipt.status !== "IN_PUTAWAY") return;
  const mine = [...(await syncTasks()).values()].filter((t) => t.goodsReceiptId === goodsReceiptId);
  if (mine.length > 0 && mine.every((t) => t.status === "DONE")) {
    receipt.status = "CLOSED";
    receipt.closedAt = new Date().toISOString();
  }
}
