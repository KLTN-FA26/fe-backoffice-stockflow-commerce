/**
 * Dựng dữ liệu cho phiếu xếp hàng in được của MỘT xe (SCRUM-287 PR F6, LP-10) từ chi tiết kế hoạch + bố cục các xe.
 * Nội dung theo báo cáo PDF EasyCargo của dự án gốc (`easycargo-pdf.ts`): bảng kê hàng theo dòng, trình tự xếp từng
 * bước (`loading-steps.ts`), danh sách kiện. Hàm thuần — không đụng DOM, không gọi API.
 */

import { formatNominalCm, mmToCm } from "./dims";
import { itemKey } from "./item-rows";
import { buildLoadingSteps } from "./loading-steps";
import { kitText, letterMapOf, orientationText } from "./print-labels";
import { unplacedLinesOf, unplacedParcels } from "../plan-selectors";

import type { LoadPlanUnplacedReason } from "@/constants";
import type { LayoutBox, Layout, UnplacedLine } from "../types";
import type { PlanDetail, PlanParcel, PlanVehicle } from "../plan-types";

const MM3_PER_M3 = 1_000_000_000;

export interface PrintParcel {
  /** Bước xếp (từ 1) mà kiện này thuộc về. */
  step: number;
  ref: string;
  /** Mã nhãn dán trên kiện; kiện không tra được trong kế hoạch thì dùng nhãn của hộp. */
  labelCode: string;
  partName: string;
  /** Chữ cái ký hiệu mặt hàng, trùng chữ in trên ảnh 3D. */
  letter: string;
  /** Số đơn hàng; rơi về mã lô khi BE không trả số đơn. */
  orderNo: string | null;
  sizeCm: string;
  weightKg: number;
  /** "Bộ x/N" khi kiện là một phần của bộ; null nếu là kiện lẻ. */
  kit: string | null;
  orientation: string;
}

export interface PrintStep {
  seq: number;
  total: number;
  partName: string;
  letter: string;
  count: number;
  /** Góc nhỏ nhất của khối: dọc xe / ngang xe / lên (cm). */
  positionCm: string;
  /** Kích thước khối dài × rộng × cao (cm). */
  blockCm: string;
  parcels: PrintParcel[];
}

export interface PrintLine {
  key: string;
  letter: string;
  partName: string;
  pieces: number;
  sizeCm: string;
  weightKg: number;
  volumeM3: number;
}

export interface PrintUnplaced {
  count: number;
  acknowledged: boolean;
  reasons: LoadPlanUnplacedReason[];
  lines: UnplacedLine[];
}

export interface PrintSheet {
  vehicle: PlanVehicle;
  layout: Layout;
  lines: PrintLine[];
  steps: PrintStep[];
  /** Mọi kiện của xe theo thứ tự xếp. */
  parcels: PrintParcel[];
  totalWeightKg: number;
  unplaced: PrintUnplaced | null;
}

function parcelRow(
  box: LayoutBox,
  step: number,
  context: {
    parcels: ReadonlyMap<string, PlanParcel>;
    orders: ReadonlyMap<string, string>;
    letters: Map<string, string>;
  },
): PrintParcel {
  const parcel = context.parcels.get(box.ref);
  return {
    step,
    ref: box.ref,
    labelCode: parcel?.labelCode ?? box.label,
    partName: box.partName,
    letter: context.letters.get(box.partName) ?? "",
    orderNo: parcel ? (context.orders.get(parcel.shipmentId) ?? parcel.shipmentCode) : null,
    sizeCm: formatNominalCm(box.origMm),
    weightKg: box.weightKg,
    kit: kitText(parcel, box),
    orientation: orientationText(box.orientation),
  };
}

const byPosition = (a: LayoutBox, b: LayoutBox): number =>
  a.zMm - b.zMm || a.yMm - b.yMm || a.xMm - b.xMm;

/** Gom kiện của xe thành dòng (mặt hàng × cỡ danh định), như bảng "Nội dung" của báo cáo EasyCargo. */
function linesOf(layout: Layout, letters: ReadonlyMap<string, string>): PrintLine[] {
  const byKey = new Map<string, PrintLine>();
  for (const box of layout.boxes) {
    const key = itemKey({ label: "", partName: box.partName, origMm: box.origMm });
    const line = byKey.get(key) ?? {
      key,
      letter: letters.get(box.partName) ?? "",
      partName: box.partName,
      pieces: 0,
      sizeCm: formatNominalCm(box.origMm),
      weightKg: 0,
      volumeM3: 0,
    };
    line.pieces += 1;
    line.weightKg += box.weightKg;
    line.volumeM3 += (box.origMm.l * box.origMm.w * box.origMm.h) / MM3_PER_M3;
    byKey.set(key, line);
  }
  return [...byKey.values()].sort(
    (a, b) => a.letter.length - b.letter.length || a.letter.localeCompare(b.letter),
  );
}

function unplacedOf(plan: PlanDetail): PrintUnplaced | null {
  const tray = unplacedParcels(plan);
  if (tray.length === 0) return null;
  const reasons = tray.flatMap((parcel) => (parcel.unplacedReason ? [parcel.unplacedReason] : []));
  return {
    count: tray.length,
    acknowledged: !!plan.unplacedAcknowledgement,
    reasons: [...new Set(reasons)],
    lines: unplacedLinesOf(tray),
  };
}

/** Phiếu của xe `seq`; null nếu kế hoạch hoặc bố cục không có xe đó. */
export function buildPrintSheet(
  plan: PlanDetail,
  layouts: readonly Layout[],
  seq: number,
): PrintSheet | null {
  const vehicle = plan.vehicles.find((v) => v.seq === seq);
  const layout = layouts.find((l) => l.seq === seq);
  if (!vehicle || !layout) return null;
  // Chữ ký hiệu tính trên cả kế hoạch để một mặt hàng cùng chữ ở mọi xe (cùng cách tính màu).
  const letters = letterMapOf(layouts.flatMap((l) => l.boxes));
  const context = {
    parcels: new Map(plan.packages.map((parcel) => [parcel.packageId, parcel])),
    orders: new Map(plan.shipments.map((s) => [s.shipmentId, s.orderNumber ?? s.code])),
    letters,
  };
  const loadingSteps = buildLoadingSteps([layout]);
  const steps: PrintStep[] = loadingSteps.map((step) => ({
    seq: step.seq,
    total: loadingSteps.length,
    partName: step.partName,
    letter: letters.get(step.partName) ?? "",
    count: step.count,
    positionCm: [step.zMm, step.xMm, step.yMm].map(mmToCm).join(" / "),
    blockCm: [step.dMm, step.wMm, step.hMm].map(mmToCm).join("×"),
    parcels: [...step.boxes].sort(byPosition).map((box) => parcelRow(box, step.seq, context)),
  }));
  return {
    vehicle,
    layout,
    lines: linesOf(layout, letters),
    steps,
    parcels: steps.flatMap((step) => step.parcels),
    totalWeightKg: layout.boxes.reduce((sum, box) => sum + box.weightKg, 0),
    unplaced: unplacedOf(plan),
  };
}
