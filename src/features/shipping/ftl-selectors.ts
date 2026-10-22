/**
 * Shipping — selector thuần cho chuyến nguyên xe (FTL, BE PR #162).
 */

import { DELIVERY_MODE, LOAD_STATUS } from "@/constants";

import type { KitPart, Load, LoadParcel, LoadRow, PendingUnload } from "./types";

type ModeOf = Pick<Load, "mode">;

/** Chuyến nguyên xe: một xe của kế hoạch xếp xe (không phải chuyến gửi kiện). */
export function isFtlLoad(load: ModeOf): boolean {
  return load.mode === DELIVERY_MODE.FULL_TRUCKLOAD;
}

/** Kiện của đơn đã huỷ còn trên xe (BE `pendingUnloads`; vắng = không có). */
export function pendingUnloadsOf(load: Pick<Load, "pendingUnloads">): readonly PendingUnload[] {
  return load.pendingUnloads ?? [];
}

/** Còn kiện phải dỡ → BE 409 LOAD_UNLOAD_PENDING khi bàn giao. */
export function hasPendingUnloads(load: Pick<Load, "pendingUnloads">): boolean {
  return pendingUnloadsOf(load).length > 0;
}

/** Chuyến đã huỷ nhưng xe vẫn còn đặt ở ngoài hệ thống → nhắc điều phối huỷ với nhà xe. */
export function needsCarrierBookingCancel(
  load: Pick<Load, "status" | "carrierBookingToCancel">,
): boolean {
  return load.status === LOAD_STATUS.CANCELLED && load.carrierBookingToCancel === true;
}

/** BE gọi huỷ tự động khi xe không còn gì để chở: lý do bắt đầu bằng "auto-cancelled". */
export function isAutoCancelled(load: Pick<Load, "cancelReason">): boolean {
  return (load.cancelReason ?? "").toLowerCase().startsWith("auto-cancelled");
}

/** Nhãn kiện đã cũ (chuyển sang lô khác sau khi in) — phải in lại trước khi quét. */
export function isLabelOutdated(parcel: Pick<LoadParcel, "labelOutdated">): boolean {
  return parcel.labelOutdated === true;
}

/** Bộ mà kiện là một phần (BE bỏ `kit` với kiện thường) → hiện "Bộ x/N". */
export function kitOf(parcel: { kit?: KitPart | null }): KitPart | null {
  return parcel.kit ?? null;
}

/** Lọc danh sách theo hình thức giao (bộ lọc "Hình thức"). */
export function filterLoadsByMode(
  rows: readonly LoadRow[],
  mode: LoadRow["mode"] | "ALL",
): LoadRow[] {
  return mode === "ALL" ? [...rows] : rows.filter((row) => row.mode === mode);
}
