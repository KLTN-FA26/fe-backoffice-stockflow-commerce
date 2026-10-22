/** Số liệu và gom nhóm từ dữ liệu kế hoạch xếp xe — hàm thuần, không side effect. */

import { LOAD_PLAN_STATUS } from "@/constants";

import { summarizeLayouts } from "./selectors";

import type { LoadPlanStatus } from "@/constants";
import type { PlanDetail, PlanParcel } from "./plan-types";
import type { LayoutSummary } from "./selectors";
import type { Layout, UnplacedLine } from "./types";

type StatusTone = "positive" | "warning" | "danger" | "info" | "neutral" | "muted";

/** Màu chấm trạng thái: bản nháp trung tính, đã tính = thông tin, đã chốt / xuất xe = xanh, đã huỷ = mờ. */
const STATUS_TONES: Record<LoadPlanStatus, StatusTone> = {
  DRAFT: "neutral",
  PLANNED: "info",
  CONFIRMED: "positive",
  DISPATCHED: "positive",
  CANCELLED: "muted",
};

export const loadPlanStatusTone = (status: LoadPlanStatus): StatusTone => STATUS_TONES[status];

/** Kế hoạch đã kết thúc (DISPATCHED / CANCELLED): chỉ xem. */
export const isFinalLoadPlan = (status: LoadPlanStatus): boolean =>
  status === LOAD_PLAN_STATUS.DISPATCHED || status === LOAD_PLAN_STATUS.CANCELLED;

/** Kiện chưa có xe (khay chưa xếp), kèm lý do. */
export function unplacedParcels(plan: Pick<PlanDetail, "packages">): PlanParcel[] {
  return plan.packages.filter((parcel) => parcel.vehicleSeq == null);
}

/** Số liệu tổng của kế hoạch từ bố cục các xe + số kiện chưa xếp BE báo. */
export function summarizePlan(
  layouts: readonly Layout[],
  plan: Pick<PlanDetail, "unplacedCount">,
): LayoutSummary {
  return summarizeLayouts(layouts, plan.unplacedCount);
}

/**
 * BE đặt `label` của hộp là mã nhãn kiện (duy nhất từng kiện) và `partName` là SKU. Bảng "số kiện theo xe" gom theo
 * (mã, tên, cỡ) nên giữ nguyên `label` sẽ ra mỗi kiện một dòng; bỏ `label` để gom theo SKU + cỡ.
 */
export function layoutsForItemTable(layouts: readonly Layout[]): Layout[] {
  return layouts.map((layout) => ({
    ...layout,
    boxes: layout.boxes.map((box) => ({ ...box, label: "" })),
  }));
}

/** Kiện chưa xếp gom theo SKU + cỡ, cùng khoá với `layoutsForItemTable`. */
export function unplacedLinesOf(parcels: readonly PlanParcel[]): UnplacedLine[] {
  const lines = new Map<string, UnplacedLine>();
  for (const parcel of parcels) {
    const key = `${parcel.partName}|${parcel.lengthMm}|${parcel.widthMm}|${parcel.heightMm}`;
    const line = lines.get(key);
    if (line) line.quantity += 1;
    else
      lines.set(key, {
        label: "",
        partName: parcel.partName,
        origMm: { l: parcel.lengthMm, w: parcel.widthMm, h: parcel.heightMm },
        quantity: 1,
      });
  }
  return [...lines.values()];
}

/** Có xe nào cần tính lại (bị bỏ kiện khi đơn bị huỷ). */
export const vehiclesNeedingRecalculation = (plan: Pick<PlanDetail, "vehicles">): number[] =>
  plan.vehicles.filter((vehicle) => vehicle.needsRecalculation).map((vehicle) => vehicle.seq);

/** Tổng số kiện / khối lượng / thể tích của các lô đã chọn trong màn lập kế hoạch. */
export function totalsOf(
  candidates: readonly { shipmentId: string; packageCount: number; packagesInOtherPlans: number }[],
  selected: ReadonlySet<string>,
): { shipments: number; packages: number } {
  const chosen = candidates.filter((candidate) => selected.has(candidate.shipmentId));
  return {
    shipments: chosen.length,
    packages: chosen.reduce((sum, c) => sum + c.packageCount - c.packagesInOtherPlans, 0),
  };
}

/**
 * Kiện đã tick ở khay mà HIỆN CÒN trên khay: sau khi tính lại / đổi đầu vào, kiện đã lên xe rời khay nên không còn ô để
 * bỏ tick — nếu vẫn gửi `addPackageIds` thì BE từ chối cả request (`LOAD_PLAN_PACKAGE_NOT_ON_TRAY`).
 */
export function pickedOnTray(
  picked: ReadonlySet<string>,
  tray: readonly Pick<PlanParcel, "packageId">[],
): Set<string> {
  const onTray = new Set(tray.map((parcel) => parcel.packageId));
  return new Set([...picked].filter((id) => onTray.has(id)));
}
