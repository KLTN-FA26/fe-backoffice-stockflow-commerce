import type {
  ItemEvaluation,
  ItemLogistics,
  ItemPolicy,
  LogisticsFormValues,
  PolicyFormValues,
  TrackingMode,
} from "./types";

const numToText = (n: number | null | undefined): string => (n == null ? "" : String(n));

/** Chính sách BE → giá trị form (null thành chuỗi rỗng). */
export function policyToForm(p: ItemPolicy): PolicyFormValues {
  return {
    reorderPoint: numToText(p.reorderPoint),
    safetyStock: numToText(p.safetyStock),
    maxQty: numToText(p.maxQty),
    maxShelfLifeDays: numToText(p.maxShelfLifeDays),
    removalStrategy: p.removalStrategy,
    trackingMode: p.trackingMode,
    expiryTracked: p.expiryTracked,
  };
}

/** Theo dõi theo lô (LOT hoặc LOT_SERIAL). */
export function isLotTracked(m: TrackingMode): boolean {
  return m === "LOT" || m === "LOT_SERIAL";
}

type Tri = "yes" | "no" | "unset";
const tri = (b: boolean | null | undefined): Tri => (b == null ? "unset" : b ? "yes" : "no");

/** `null` nghĩa là ngưỡng chưa đặt nên BE không đánh giá được. */
export function evaluationState(e: ItemEvaluation): { reorder: Tri; belowSafety: Tri } {
  return { reorder: tri(e.reorderRequired), belowSafety: tri(e.belowSafetyStock) };
}

/** Logistics BE → giá trị form (null thành chuỗi rỗng; số kiện / quy cách luôn có). */
export function logisticsToForm(l: ItemLogistics): LogisticsFormValues {
  return {
    unitOfMeasure: l.unitOfMeasure,
    barcode: l.barcode ?? "",
    weightKg: numToText(l.weightKg),
    lengthCm: numToText(l.lengthCm),
    widthCm: numToText(l.widthCm),
    heightCm: numToText(l.heightCm),
    packageWeightKg: numToText(l.packageWeightKg),
    packageLengthCm: numToText(l.packageLengthCm),
    packageWidthCm: numToText(l.packageWidthCm),
    packageHeightCm: numToText(l.packageHeightCm),
    packageCount: String(l.packageCount),
    packSize: String(l.packSize),
    storageClass: l.storageClass,
    requiresAdultSignature: l.requiresAdultSignature,
    shippingRestrictionNote: l.shippingRestrictionNote ?? "",
    qcRequired: l.qcRequired,
    rotatable: l.rotatable,
  };
}
