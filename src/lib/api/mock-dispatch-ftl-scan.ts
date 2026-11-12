/**
 * Mock chuyến xe — kiểm tra quét kiện đúng xe: chuyến chỉ nhận kiện kế hoạch xếp lên xe đó; kiện của xe khác → 409
 * PACKAGE_NOT_IN_LOAD nêu xe đúng (`vehicleSeq` / `loadCode`). Tách khỏi `mock-dispatch-ftl-rules.ts`.
 */

import { fail } from "./mock-route-utils";

import type { DispatchState, MockLoad, MockParcel } from "./mock-dispatch-store";
import type { MockResponseShape } from "./mock-route-utils";

/** Xe khác (còn sống) của kế hoạch mà kiện được xếp lên. */
function placedElsewhere(state: DispatchState, load: MockLoad, packageId: string) {
  return [...state.loads.values()].find(
    (other) =>
      other.loadId !== load.loadId &&
      other.status !== "CANCELLED" &&
      other.ftl.placed.has(packageId),
  );
}

/** Quét kiện: kiện kế hoạch xếp lên xe khác → 409 PACKAGE_NOT_IN_LOAD kèm xe đúng; kiện ngoài kế hoạch → 409 không kèm xe. */
export function ftlScanCheck(
  state: DispatchState,
  load: MockLoad,
  parcel: MockParcel,
): MockResponseShape | null {
  if (load.ftl.placed.has(parcel.packageId)) return null;
  const other = placedElsewhere(state, load, parcel.packageId);
  if (!other) {
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
