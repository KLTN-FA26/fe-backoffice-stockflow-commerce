/**
 * Mock `GET /inventory/stock-packages/bin-suggestions?lpn=…&lpn=…` — bin nhận được mọi thùng của một lệnh chuyển, chỉ
 * dùng khi USE_MOCK=true.
 *
 * Hợp đồng chép từ BE #412 (issue, CHƯA có code trên develop 2026-11-25; nghiệp vụ docs#46): `{ suggestions:
 * [{locationCode, reason, freeVolumeM3, freeWeightKg}], overflowAreas }`. Dùng lại bộ xếp hạng mock của cất hàng
 * (`mock-putaway-store`, BE `PutawayRanker`, docs 05 §4.3) cho cả nhóm thùng:
 * - bỏ vị trí hiện tại của các thùng, bin không dùng được / không cho cất (BR-04);
 * - thể tích + tải còn trống phải đủ cho CẢ nhóm (tính cả chỗ chuyến cất hàng đang giữ, 05 BR-16);
 * - `SAME_LOT` / `SAME_SKU` chỉ khi mọi thùng đều đạt;
 * - không bin nào nhận → các khu OVERFLOW dùng được của kho (05 BR-13).
 * Lỗi: 404 STOCK_PACKAGE_NOT_FOUND, 409 MOVE_ACROSS_WAREHOUSES. Thùng không chuyển được (giữ, không IN_STOCK) KHÔNG bị
 * từ chối ở đây — lệnh chuyển từ chối nó.
 *
 * ASSUMPTION (mock): không có kích thước từng thùng (06 BR-01 "vừa theo từng chiều") — mọi thùng coi như cùng khối
 * `MOCK_CARTON_VOLUME_M3`; mock `POST /inventory/movements` cũng không kiểm CARTON_DOES_NOT_FIT_BIN, nên bin gợi ý
 * luôn được lệnh chuyển nhận.
 */

import { PUTAWAY_SUGGESTION_REASONS } from "@/constants/putaway";

import { MOVE_API } from "@/constants/move";

import { registerMockRoute } from "./mock-adapter";
import { findMockCarton, mockWarehouseCodeOf } from "./mock-inventory-cartons";
import {
  areasOfWarehouse,
  binsOfWarehouse,
  cartonWeight,
  freeOf,
  MOCK_CARTON_VOLUME_M3,
} from "./mock-putaway-store";
import { ok } from "./mock-route-utils";
import { beError } from "./mock-routes-purchase-orders-store";

import type { AxiosRequestConfig } from "axios";
import type { MockCarton } from "./mock-inventory-cartons";

type Reason = (typeof PUTAWAY_SUGGESTION_REASONS)[number];

// BE PutawayRanker.MAX_SUGGESTIONS (docs 05 §4.3: tối đa 10 bin).
const MAX_SUGGESTIONS = 10;

const upper = (value: string | null | undefined) => (value ?? "").trim().toUpperCase();

/** `lpn` lặp lại trên query (`?lpn=A&lpn=B`) — axios mock gửi qua `params`, chuỗi hoặc mảng. */
function lpnsOf(config: AxiosRequestConfig): string[] {
  const raw: unknown = (config.params as Record<string, unknown> | undefined)?.lpn;
  const values = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
  return [...new Set(values.map((value) => upper(String(value))).filter(Boolean))];
}

/** Lý do của cả nhóm: SAME_LOT / SAME_SKU chỉ khi mọi thùng đạt (BE #412). */
function reasonOf(cartons: readonly MockCarton[], inside: readonly MockCarton[]): Reason {
  if (inside.length === 0) return "EMPTY";
  const sameSku = (c: MockCarton) => inside.some((i) => i.sku === c.sku);
  const sameLot = (c: MockCarton) =>
    inside.some((i) => i.sku === c.sku && (i.lotNumber ?? "") === (c.lotNumber ?? ""));
  if (cartons.every(sameLot)) return "SAME_LOT";
  return cartons.every(sameSku) ? "SAME_SKU" : "OTHER_SKU";
}

export async function moveSuggestionsFor(cartons: readonly MockCarton[]) {
  const warehouse = mockWarehouseCodeOf(cartons[0]?.pkg.locationCode ?? null);
  const here = new Set(cartons.map((c) => upper(c.pkg.locationCode)));
  const volume = cartons.length * MOCK_CARTON_VOLUME_M3;
  const weight = cartons.reduce((sum, c) => sum + cartonWeight(c.pkg.receivedQty), 0);
  const ranked = [];
  for (const bin of binsOfWarehouse(warehouse)) {
    if (!bin.usable || !bin.putawayTarget || here.has(upper(bin.locationCode))) continue;
    const free = await freeOf(bin);
    if (free.freeVolumeM3 != null && free.freeVolumeM3 < volume) continue;
    if (free.freeWeightKg != null && free.freeWeightKg < weight) continue;
    ranked.push({
      locationCode: bin.locationCode,
      reason: reasonOf(cartons, free.inside),
      freeVolumeM3: free.freeVolumeM3 == null ? null : Number(free.freeVolumeM3.toFixed(3)),
      freeWeightKg: free.freeWeightKg,
    });
  }
  const group = (reason: Reason) => PUTAWAY_SUGGESTION_REASONS.indexOf(reason);
  // PutawayRanker: bin đo được trước → nhóm lý do → vừa khít (ít chỗ trống nhất) → mã.
  ranked.sort(
    (a, b) =>
      Number(b.freeVolumeM3 != null) - Number(a.freeVolumeM3 != null) ||
      group(a.reason) - group(b.reason) ||
      (a.freeVolumeM3 ?? 0) - (b.freeVolumeM3 ?? 0) ||
      a.locationCode.localeCompare(b.locationCode),
  );
  const suggestions = ranked.slice(0, MAX_SUGGESTIONS);
  const overflowAreas =
    suggestions.length > 0
      ? []
      : areasOfWarehouse(warehouse)
          .filter(
            (area) =>
              area.type === "OVERFLOW" && area.usable && !here.has(upper(area.locationCode)),
          )
          .map((area) => area.locationCode);
  return { suggestions, overflowAreas };
}

async function binSuggestions(config: AxiosRequestConfig) {
  const { useAuthStore } = await import("@/lib/auth/auth-store");
  if (!useAuthStore.getState().user) return beError(401, "UNAUTHORIZED", "Authentication required");
  const lpns = lpnsOf(config);
  if (lpns.length === 0) return beError(400, "VALIDATION_FAILED", "lpn needs at least one carton");
  const cartons: MockCarton[] = [];
  for (const lpn of lpns) {
    const carton = await findMockCarton(lpn);
    if (!carton) return beError(404, "STOCK_PACKAGE_NOT_FOUND", `No stock package ${lpn}`);
    cartons.push(carton);
  }
  const warehouses = new Set(cartons.map((c) => mockWarehouseCodeOf(c.pkg.locationCode)));
  // Docs 11 BR-01.
  if (warehouses.size > 1)
    return beError(409, "MOVE_ACROSS_WAREHOUSES", "The cartons are in different warehouses");
  return ok(await moveSuggestionsFor(cartons));
}

/** Đăng ký TRƯỚC `GET /inventory/stock-packages/:lpn` — adapter lấy route khớp đầu tiên. */
export function registerMoveSuggestionMockRoutes(): void {
  registerMockRoute("GET", MOVE_API.binSuggestions, binSuggestions);
}
