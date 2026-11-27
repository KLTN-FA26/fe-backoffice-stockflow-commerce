/**
 * Mock tra cứu thùng của BE develop #461 (issue #454), chỉ dùng khi USE_MOCK=true: các bộ lọc `warehouseId`,
 * `lotNumber`, `q`, `stockStatus` và sort `receivedAt` cho `GET /inventory/stock-packages`, cùng các field đọc được
 * (kho, sản phẩm, trạng thái tồn, phiếu nhận, nguồn, việc đang làm) của mỗi dòng.
 *
 * Không bịa dữ liệu: việc đang làm lấy từ nhiệm vụ cất / dòng lấy hàng có thật trong mock; `heldFor` để rỗng vì mock
 * lấy hàng không nối thùng với đơn. Tên sản phẩm chỉ cho hai SKU của kho demo (BE issue #474), SKU khác → null.
 */

import { CARTON_SEARCH_MIN } from "@/constants";

import { isMockQuarantined, mockWarehouseCodeOf } from "./mock-inventory-cartons";
import { listPutawayTasks } from "./mock-putaway-store";
import { listMockPickLines } from "./mock-routes-pick-lines-store";
import { getWarehouseStore } from "./mock-warehouse-store";

import type { MockCarton } from "./mock-inventory-cartons";

/** Thời điểm seed thùng tồn đầu kỳ của BE (`V20261111000110`). */
const OPENING_RECEIVED_AT = "2026-11-11T13:19:35.225Z";

const PRODUCTS: Record<string, { productName: string; variantName: string }> = {
  "CUP-PP-500": { productName: "Ly nhựa PP", variantName: "Ly nhựa PP 500 ml" },
  "BAG-CUP-2": { productName: "Túi đựng ly", variantName: "Túi đựng 2 ly" },
};

const OPEN_PUTAWAY = new Set(["PENDING", "IN_PROGRESS"]);
const OPEN_PICK = new Set(["OPEN"]);

/** Trạng thái tồn của hàng trong thùng (docs 20 §5.1) — như `detail()` của mock cách ly. */
export function mockStockStatusOf(carton: MockCarton): string {
  if (isMockQuarantined(carton.pkg.lpn)) return "QUARANTINE";
  return carton.pkg.status === "RECEIVING" ? "INBOUND" : "AVAILABLE";
}

const holding = (carton: MockCarton) =>
  carton.pkg.status === "IN_STOCK" || carton.pkg.status === "RECEIVING";

export interface LookupContext {
  openTaskOf: (lpn: string) => { type: string; id: string; number: null } | null;
  warehouseIdOf: (code: string) => string | null;
}

/** Dựng một lần mỗi request: nhiệm vụ cất / dòng lấy hàng đang mở theo LPN, id kho theo mã kho. */
export async function lookupContext(): Promise<LookupContext> {
  const tasks = new Map<string, { type: string; id: string; number: null }>();
  for (const task of await listPutawayTasks())
    if (OPEN_PUTAWAY.has(task.status))
      tasks.set(task.lpn.toUpperCase(), { type: "PUTAWAY", id: task.id, number: null });
  for (const line of listMockPickLines())
    if (OPEN_PICK.has(line.status))
      tasks.set(line.lpn.toUpperCase(), { type: "PICK", id: line.taskId, number: null });
  const ids = new Map(
    [...getWarehouseStore().warehouses.values()].map((w) => [w.prefix.toUpperCase(), w.id]),
  );
  return {
    openTaskOf: (lpn) => tasks.get(lpn.toUpperCase()) ?? null,
    warehouseIdOf: (code) => ids.get(code.toUpperCase()) ?? null,
  };
}

/** Các field đọc được của BE #454 cho một thùng. */
export function lookupFields(carton: MockCarton, context: LookupContext) {
  const warehouseCode = carton.pkg.locationCode
    ? mockWarehouseCodeOf(carton.pkg.locationCode)
    : null;
  const product = PRODUCTS[carton.sku];
  return {
    warehouseId: warehouseCode ? context.warehouseIdOf(warehouseCode) : null,
    warehouseCode,
    productName: product?.productName ?? null,
    variantName: product?.variantName ?? null,
    stockStatuses: holding(carton) ? [mockStockStatusOf(carton)] : [],
    receivedAt: holding(carton) ? (carton.receipt?.receivedAt ?? OPENING_RECEIVED_AT) : null,
    goodsReceiptId: carton.receipt?.id ?? null,
    goodsReceiptNumber: carton.receipt?.number ?? null,
    source: carton.receipt ? "GOODS_RECEIPT" : "IN_WAREHOUSE",
    heldFor: [],
    openTask: context.openTaskOf(carton.pkg.lpn),
  };
}

export interface LookupFilters {
  warehouseCode: string | null;
  lotNumber: string;
  q: string;
  stockStatuses: string[] | null;
}

/** Bộ lọc mới của BE #454; `q` đã kiểm ≥ 3 ký tự ở route (400 nếu ngắn hơn). */
export function matchesLookup(carton: MockCarton, filters: LookupFilters): boolean {
  const code = carton.pkg.locationCode ? mockWarehouseCodeOf(carton.pkg.locationCode) : null;
  if (filters.warehouseCode && code !== filters.warehouseCode) return false;
  if (filters.lotNumber && (carton.lotNumber ?? "").toUpperCase() !== filters.lotNumber)
    return false;
  if (filters.q && !carton.pkg.lpn.toUpperCase().includes(filters.q.toUpperCase())) return false;
  if (
    filters.stockStatuses &&
    !(holding(carton) && filters.stockStatuses.includes(mockStockStatusOf(carton)))
  )
    return false;
  return true;
}

export const LOOKUP_SEARCH_MIN = CARTON_SEARCH_MIN;

/** Sort `field,dir` của BE; mặc định theo LPN. */
export function compareLookup(sort: string, context: LookupContext) {
  const [field = "lpn", dir = "asc"] = sort.split(",");
  const sign = dir === "desc" ? -1 : 1;
  const key = (carton: MockCarton): string => {
    if (field === "receivedAt") return lookupFields(carton, context).receivedAt ?? "";
    if (field === "locationCode") return carton.pkg.locationCode ?? "";
    if (field === "sku") return carton.sku;
    return carton.pkg.lpn;
  };
  return (a: MockCarton, b: MockCarton) =>
    sign * (key(a).localeCompare(key(b)) || a.pkg.lpn.localeCompare(b.pkg.lpn));
}
