/**
 * Mock chuyến nguyên xe — kiểm tra quét kiện đúng xe (BE PR #162): nhãn cũ, kiện của xe khác kèm
 * `vehicleSeq` / `loadCode`, kiện của kế hoạch quét ở chuyến gửi kiện. Tách khỏi `mock-dispatch-ftl-rules.ts`.
 */

import { fail } from "./mock-route-utils";

import type { DispatchState, MockLoad, MockParcel } from "./mock-dispatch-store";
import type { MockResponseShape } from "./mock-route-utils";

/** Xe khác (còn sống) của kế hoạch mà kiện được xếp lên. */
function placedElsewhere(state: DispatchState, load: MockLoad, packageId: string) {
  return [...state.loads.values()].find(
    (other) =>
      other.ftl &&
      other.loadId !== load.loadId &&
      other.status !== "CANCELLED" &&
      other.ftl.placed.has(packageId),
  );
}

/**
 * Quét kiện: nhãn cũ (kiện đã chuyển lô) → 409 LABEL_OUTDATED; trên xe nguyên xe chỉ nhận kiện kế hoạch xếp
 * lên xe đó — kiện của xe khác → 409 PACKAGE_NOT_IN_LOAD nêu xe đúng; trên chuyến gửi kiện, kiện của kế hoạch
 * → 409 PACKAGE_REQUIRES_LOAD_PLAN.
 */
export function ftlScanCheck(
  state: DispatchState,
  load: MockLoad,
  parcel: MockParcel,
): MockResponseShape | null {
  if (parcel.labelOutdated && !load.loaded.has(parcel.packageId)) {
    return fail(
      409,
      "LABEL_OUTDATED",
      `Package ${parcel.labelCode} moved to another shipment since its label was printed: reprint its label before loading it`,
    );
  }
  if (!load.ftl) {
    const owner = [...state.loads.values()].find((l) => l.ftl?.placed.has(parcel.packageId));
    return owner
      ? fail(409, "PACKAGE_REQUIRES_LOAD_PLAN", "Full-truckload packages go through a load plan")
      : null;
  }
  if (load.ftl.placed.has(parcel.packageId)) return null;
  const other = placedElsewhere(state, load, parcel.packageId);
  if (!other?.ftl) {
    return fail(
      409,
      "PACKAGE_NOT_IN_LOAD",
      `Package ${parcel.labelCode} is not on the manifest of ${load.code}`,
    );
  }
  return fail(
    409,
    "PACKAGE_NOT_IN_LOAD",
    `Package ${parcel.labelCode} is placed on vehicle ${other.ftl.vehicleSeq} (load ${other.code}) of plan ${other.ftl.loadPlanCode}, not on load ${load.code}`,
    [
      { field: "vehicleSeq", message: String(other.ftl.vehicleSeq) },
      { field: "loadCode", message: other.code },
    ],
  );
}
