/**
 * Dựng trạng thái soạn từ kế hoạch + bố cục các xe + cửa theo loại xe. Trả `null` khi hai nguồn lệch nhau (vừa tải lại
 * dở: kế hoạch và bố cục khác phiên bản) — soạn trên dữ liệu lệch sẽ gửi một danh sách kiện sai lên BE (`PACKAGE_MISSING`).
 */

import { trayParcelOf } from "./parcels";

import type { PlanDetail } from "../plan-types";
import type { DoorMm, Layout } from "../types";
import type { EditorState } from "./types";

export type DoorsByType = ReadonlyMap<string, DoorMm>;

export function buildEditorState(
  plan: Pick<PlanDetail, "vehicles" | "packages">,
  layouts: readonly Layout[],
  doors: DoorsByType = new Map(),
): EditorState | null {
  const seqOfParcel = new Map(plan.packages.map((p) => [p.packageId, p.vehicleSeq ?? null]));
  const vehicles: EditorState["vehicles"][number][] = [];
  const placed = new Set<string>();
  for (const summary of plan.vehicles) {
    const layout = layouts.find((l) => l.seq === summary.seq);
    if (!layout || layout.code !== summary.code) return null;
    for (const box of layout.boxes) {
      if (seqOfParcel.get(box.ref) !== layout.seq || placed.has(box.ref)) return null;
      placed.add(box.ref);
    }
    vehicles.push({
      seq: layout.seq,
      code: layout.code,
      vehicleTypeId: summary.vehicleTypeId,
      innerMm: layout.innerMm,
      maxPayloadKg: layout.maxPayloadKg,
      gussets: layout.gussets,
      door: doors.get(summary.vehicleTypeId) ?? null,
      boxes: layout.boxes,
    });
  }
  const tray = plan.packages.filter((p) => p.vehicleSeq == null).map(trayParcelOf);
  // Mọi kiện có xe phải nằm trong bố cục của xe đó
  const onVehicles = plan.packages.filter((p) => p.vehicleSeq != null).length;
  if (onVehicles !== placed.size) return null;
  return { vehicles, tray };
}
