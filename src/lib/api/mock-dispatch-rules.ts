/**
 * Mock giao hàng cho hãng — quét kiện lên xe, mã lỗi đúng BE `DispatchService` / `DispatchLoad`: quét theo biên bản
 * (mỗi mã lỗi một ngữ cảnh), `scanId` replay. Đặt xe / bắt đầu xếp / dỡ kiện / huỷ có kiểm soát: `mock-dispatch-ftl-rules.ts`;
 * bàn giao: `mock-dispatch-handover.ts`; mã vận đơn: `mock-dispatch-waybill.ts`.
 */

import { MOCK_DISPATCHER, type DispatchState, type MockLoad } from "./mock-dispatch-store";
import { ftlScanCheck } from "./mock-dispatch-ftl-scan";
import { loadDetailView } from "./mock-dispatch-view";
import { fail, ok, validationFailed } from "./mock-route-utils";

import type { MockResponseShape } from "./mock-route-utils";

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const stamp = () => new Date().toISOString();

const detail = (state: DispatchState, load: MockLoad) => ok(loadDetailView(state, load));
const invalidTransition = (load: MockLoad, action: string) =>
  fail(409, "INVALID_LOAD_TRANSITION", `Load ${load.code} is ${load.status}; it cannot ${action}`);

export function scan(
  state: DispatchState,
  load: MockLoad,
  body: Record<string, unknown>,
): MockResponseShape {
  const scanId = text(body.scanId) || crypto.randomUUID();
  const code = text(body.packageCode);
  if (!code) return validationFailed("packageCode", "must not be blank");
  const all = [...state.shipments.values()];
  const owner = all.find((s) =>
    s.parcels.some((p) => p.labelCode.toUpperCase() === code.toUpperCase()),
  );
  const parcel = owner?.parcels.find((p) => p.labelCode.toUpperCase() === code.toUpperCase());
  // Một scanId đã ghi được trả lời trước, bất kể chuyện gì xảy ra sau
  for (const candidate of state.loads.values()) {
    for (const loaded of candidate.loaded.values()) {
      if (loaded.scanId !== scanId) continue;
      const same = candidate.loadId === load.loadId && loaded.packageId === parcel?.packageId;
      return same
        ? detail(state, load)
        : fail(
            409,
            "LOAD_SCAN_ID_CONFLICT",
            `Scan ${scanId} was recorded for another package or load`,
          );
    }
  }
  if (!owner || !parcel) return fail(404, "PACKAGE_NOT_FOUND", `No package labelled ${code}`);
  // Kiện thuộc xe khác của kế hoạch (hoặc ngoài kế hoạch): 409 nêu xe đúng
  const wrongVehicle = ftlScanCheck(state, load, parcel);
  if (wrongVehicle) return wrongVehicle;
  if (load.status !== "LOADING") return invalidTransition(load, "scan packages");
  if (owner.status !== "READY_TO_DISPATCH") {
    return fail(
      409,
      "PACKAGE_NOT_READY",
      `Package ${code} belongs to shipment ${owner.code}, which is ${owner.status}`,
    );
  }
  const elsewhere = [...state.loads.values()].find(
    (l) => l.loadId !== load.loadId && l.status !== "CANCELLED" && l.loaded.has(parcel.packageId),
  );
  if (elsewhere)
    return fail(
      409,
      "PACKAGE_ALREADY_LOADED",
      `Package ${code} is already on load ${elsewhere.code}`,
    );
  if (load.loaded.has(parcel.packageId)) return detail(state, load);
  load.loaded.set(parcel.packageId, {
    packageId: parcel.packageId,
    scanId,
    loadedAt: stamp(),
    loadedBy: MOCK_DISPATCHER,
  });
  load.version += 1;
  return detail(state, load);
}

export function unscan(state: DispatchState, load: MockLoad, packageId: string): MockResponseShape {
  if (load.status !== "LOADING") return invalidTransition(load, "unload packages");
  if (load.loaded.delete(packageId)) load.version += 1;
  return detail(state, load);
}
