/** Số liệu và gom nhóm từ dữ liệu kế hoạch xếp xe — hàm thuần, không side effect. */

import { LOAD_PLAN_SELECTION_MODE, LOAD_PLAN_STATUS } from "@/constants";

import { summarizeLayouts } from "./selectors";

import type { LoadPlanSelectionMode, LoadPlanStatus } from "@/constants";
import type { CandidateShipment, PlanDetail, PlanParcel } from "./plan-types";
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

/**
 * Tên sản phẩm theo `partName` (SKU) từ `packages[]` của kế hoạch — chú giải 3D và bảng kiện tra tên ở đây vì bố cục xe
 * (`layouts`) chỉ có SKU (BE PR #488). Kiện chưa có tên (BE cũ) bỏ qua; hai kiện cùng SKU thì tên đầu tiên.
 */
export function productNamesByPart(
  parcels: readonly Pick<PlanParcel, "partName" | "productName">[],
): ReadonlyMap<string, string> {
  const names = new Map<string, string>();
  for (const parcel of parcels)
    if (parcel.productName && !names.has(parcel.partName))
      names.set(parcel.partName, parcel.productName);
  return names;
}

/** Lô giao khớp ô tìm: mã lô, số đơn, tên khách hoặc tỉnh giao (không phân biệt hoa thường). */
export function shipmentMatches(
  candidate: Pick<
    CandidateShipment,
    "code" | "orderNumber" | "customerName" | "deliveryProvinceName"
  >,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [
    candidate.code,
    candidate.orderNumber,
    candidate.customerName,
    candidate.deliveryProvinceName,
  ].some((value) => (value ?? "").toLowerCase().includes(needle));
}

/** Có xe nào cần tính lại (bị bỏ kiện khi đơn bị huỷ). */
export const vehiclesNeedingRecalculation = (plan: Pick<PlanDetail, "vehicles">): number[] =>
  plan.vehicles.filter((vehicle) => vehicle.needsRecalculation).map((vehicle) => vehicle.seq);

/** Một dòng đơn của các lô đã chọn: ô tick "hàng chèn" của chế độ Ưu tiên + hàng chèn (RTM-LPGROUP). */
export interface FillLineOption {
  orderLineId: string;
  shipmentCode: string;
  sku: string;
  /** Tên sản phẩm của dòng (BE PR #488), vắng khi chưa rõ. */
  productName?: string;
  packages: number;
}

/** Các dòng đơn (theo kiện) của những lô đã chọn, theo thứ tự lô rồi dòng; kiện không rõ dòng bỏ qua. */
export function fillLineOptions(
  candidates: readonly Pick<CandidateShipment, "shipmentId" | "code" | "packages">[],
  selected: ReadonlySet<string>,
): FillLineOption[] {
  const out = new Map<string, FillLineOption>();
  for (const candidate of candidates) {
    if (!selected.has(candidate.shipmentId ?? "")) continue;
    for (const parcel of candidate.packages) {
      if (!parcel.orderLineId) continue;
      const known = out.get(parcel.orderLineId);
      if (known) known.packages += 1;
      else
        out.set(parcel.orderLineId, {
          orderLineId: parcel.orderLineId,
          shipmentCode: candidate.code,
          sku: parcel.partName,
          ...(parcel.productName ? { productName: parcel.productName } : {}),
          packages: 1,
        });
    }
  }
  return [...out.values()];
}

/**
 * Dòng hàng chèn để gửi BE: chỉ với `PRIORITY_FILL` (mặc định mọi dòng là hàng chính), chỉ dòng của lô đang chọn. Chế độ
 * khác → `undefined` (không gửi; BE không giữ hàng chèn dưới chế độ khác).
 */
export function fillLinesToSend(
  mode: LoadPlanSelectionMode,
  ticked: ReadonlySet<string>,
  options: readonly FillLineOption[],
): string[] | undefined {
  if (mode !== LOAD_PLAN_SELECTION_MODE.PRIORITY_FILL) return undefined;
  return options.map((o) => o.orderLineId).filter((id) => ticked.has(id));
}

/** Tổng số lô / kiện / khối lượng (kg) / thể tích (mm³) của các lô đã chọn trong màn lập kế hoạch. */
export function totalsOf(
  candidates: readonly Pick<
    CandidateShipment,
    "shipmentId" | "packageCount" | "packagesInOtherPlans" | "weightKg" | "volumeMm3"
  >[],
  selected: ReadonlySet<string>,
): { shipments: number; packages: number; weightKg: number; volumeMm3: number } {
  const chosen = candidates.filter((candidate) => selected.has(candidate.shipmentId));
  return {
    shipments: chosen.length,
    packages: chosen.reduce((sum, c) => sum + c.packageCount - c.packagesInOtherPlans, 0),
    weightKg: chosen.reduce((sum, c) => sum + c.weightKg, 0),
    volumeMm3: chosen.reduce((sum, c) => sum + c.volumeMm3, 0),
  };
}

/** Lô sắp theo giờ sẵn sàng, sớm nhất trước; chưa có giờ xuống cuối; bằng nhau theo mã lô. Bản mới, không sửa mảng gốc. */
export function sortByReadyAt<T extends Pick<CandidateShipment, "code" | "readyAt">>(
  candidates: readonly T[],
): T[] {
  const time = (candidate: T) => {
    const parsed = candidate.readyAt ? Date.parse(candidate.readyAt) : Number.NaN;
    return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
  };
  return [...candidates].sort(
    (a, b) =>
      (time(a) === time(b) ? 0 : time(a) < time(b) ? -1 : 1) || a.code.localeCompare(b.code),
  );
}

/** Mã đơn khác nhau của các lô đã chọn (mỗi đơn một ước tính tải). */
export function orderIdsOf(
  candidates: readonly Pick<CandidateShipment, "shipmentId" | "orderId">[],
  selected: ReadonlySet<string>,
): string[] {
  return [...new Set(candidates.filter((c) => selected.has(c.shipmentId)).map((c) => c.orderId))];
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

/**
 * Nhãn kho xuất của kế hoạch từ mã + tên BE trả (#286): "HN · Kho Hà Nội"; chỉ có tên → tên; BE cũ chưa trả → null (ô ghi
 * "—", không bao giờ hiện UUID thô, không tải danh mục kho chỉ để hiện tên).
 */
export function planWarehouseLabel(plan: {
  warehouseCode?: string | null;
  warehouseName?: string | null;
}): string | null {
  if (!plan.warehouseName) return plan.warehouseCode ?? null;
  return plan.warehouseCode ? `${plan.warehouseCode} · ${plan.warehouseName}` : plan.warehouseName;
}
