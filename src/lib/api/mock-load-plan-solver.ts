/**
 * Bộ xếp giả của mock kế hoạch xếp xe — KHÔNG phải solver thật (BE PR #156 `KitSolver`). Đủ để màn lập kế hoạch và
 * chi tiết có bố cục để xem: xếp từng lớp trên sàn, hàng theo trục x rồi trục z, kiện đặt `LWH` (hoặc xoay vừa khung
 * nếu `rotatable`). Giữ đúng các lý do chưa xếp của BE: TOO_LARGE, TOO_HEAVY, NO_VEHICLE_AVAILABLE, NO_SPACE.
 * Không bảo đảm đỡ ≥ 98% đáy hay giữ bộ trên một xe như solver thật.
 */

import { LAYOUT_ORIENTATIONS } from "@/constants";
import { orientedExtent } from "@/features/load-planning/lib/dims";

import type { LayoutOrientation, LoadPlanUnplacedReason } from "@/constants";
import type { ExtentMm } from "@/features/load-planning/types";
import type { MockParcel } from "./mock-load-plan-store";
import type { MockVehicleType } from "./mock-vehicle-type-store";

export interface PlacedBox {
  parcel: MockParcel;
  orientation: LayoutOrientation;
  xMm: number;
  yMm: number;
  zMm: number;
  extent: ExtentMm;
}

export interface SolvedVehicle {
  type: MockVehicleType;
  boxes: PlacedBox[];
}

export interface SolveResult {
  vehicles: SolvedVehicle[];
  unplaced: { parcel: MockParcel; reason: LoadPlanUnplacedReason }[];
}

const dimsOf = (parcel: MockParcel) => ({
  l: parcel.lengthMm,
  w: parcel.widthMm,
  h: parcel.heightMm,
});

/** Hướng đầu tiên cho kiện vừa lòng xe (kiện không xoay được chỉ có `LWH`). */
export function fittingOrientation(
  parcel: MockParcel,
  type: Pick<MockVehicleType, "innerLengthMm" | "innerWidthMm" | "innerHeightMm">,
): { orientation: LayoutOrientation; extent: ExtentMm } | null {
  const orientations: readonly LayoutOrientation[] = parcel.rotatable
    ? LAYOUT_ORIENTATIONS
    : ["LWH"];
  for (const orientation of orientations) {
    const extent = orientedExtent(dimsOf(parcel), orientation);
    if (
      extent.wMm <= type.innerWidthMm &&
      extent.hMm <= type.innerHeightMm &&
      extent.dMm <= type.innerLengthMm
    )
      return { orientation, extent };
  }
  return null;
}

/** Một xe đang xếp: con trỏ lớp (y), hàng (z) và vị trí trong hàng (x). */
class OpenVehicle {
  readonly boxes: PlacedBox[] = [];
  private x = 0;
  private z = 0;
  private y = 0;
  private rowDepth = 0;
  private layerHeight = 0;
  private weightKg = 0;

  constructor(readonly type: MockVehicleType) {}

  tryPlace(parcel: MockParcel): boolean {
    const fit = fittingOrientation(parcel, this.type);
    if (!fit || this.weightKg + parcel.weightKg > this.type.maxPayloadKg) return false;
    const { extent } = fit;
    let { x, z, y, rowDepth, layerHeight } = this;
    if (x + extent.wMm > this.type.innerWidthMm) {
      x = 0;
      z += rowDepth;
      rowDepth = 0;
    }
    if (z + extent.dMm > this.type.innerLengthMm) {
      x = 0;
      z = 0;
      y += layerHeight;
      rowDepth = 0;
      layerHeight = 0;
    }
    if (y + extent.hMm > this.type.innerHeightMm) return false;
    this.boxes.push({ parcel, orientation: fit.orientation, xMm: x, yMm: y, zMm: z, extent });
    this.x = x + extent.wMm;
    this.z = z;
    this.y = y;
    this.rowDepth = Math.max(rowDepth, extent.dMm);
    this.layerHeight = Math.max(layerHeight, extent.hMm);
    this.weightKg += parcel.weightKg;
    return true;
  }
}

const volumeOf = (parcel: MockParcel) => parcel.lengthMm * parcel.widthMm * parcel.heightMm;

/**
 * Xếp `parcels` lên các xe của `types` (đã sắp theo tải trọng giảm dần). `SINGLE_TYPE` chỉ dùng loại lớn nhất mà kiện
 * vừa; `FEWEST_VEHICLES` được dùng thêm loại khác khi hết xe loại lớn. `limit` mỗi loại = `availableCount` (BR-12).
 */
export function solveMock(
  parcels: readonly MockParcel[],
  types: readonly MockVehicleType[],
  mode: "SINGLE_TYPE" | "FEWEST_VEHICLES",
): SolveResult {
  const ordered = [...types].sort((a, b) => b.maxPayloadKg - a.maxPayloadKg);
  const usable = mode === "SINGLE_TYPE" ? ordered.slice(0, 1) : ordered;
  const open: OpenVehicle[] = [];
  const unplaced: SolveResult["unplaced"] = [];
  for (const parcel of [...parcels].sort((a, b) => volumeOf(b) - volumeOf(a))) {
    const fitting = usable.filter((type) => fittingOrientation(parcel, type));
    if (fitting.length === 0) {
      unplaced.push({ parcel, reason: "TOO_LARGE" });
      continue;
    }
    if (!fitting.some((type) => parcel.weightKg <= type.maxPayloadKg)) {
      unplaced.push({ parcel, reason: "TOO_HEAVY" });
      continue;
    }
    if (open.some((vehicle) => vehicle.tryPlace(parcel))) continue;
    const next = fitting.find(
      (type) =>
        open.filter((vehicle) => vehicle.type.vehicleTypeId === type.vehicleTypeId).length <
        type.availableCount,
    );
    if (!next) {
      unplaced.push({ parcel, reason: "NO_VEHICLE_AVAILABLE" });
      continue;
    }
    const vehicle = new OpenVehicle(next);
    if (vehicle.tryPlace(parcel)) open.push(vehicle);
    else unplaced.push({ parcel, reason: "NO_SPACE" });
  }
  return {
    vehicles: open.map((vehicle) => ({ type: vehicle.type, boxes: vehicle.boxes })),
    unplaced,
  };
}
