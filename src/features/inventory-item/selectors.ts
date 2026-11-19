import type { ItemLogistics, LogisticsFormValues } from "./types";

const numToText = (n: number | null | undefined): string => (n == null ? "" : String(n));

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
    rotatable: l.rotatable,
  };
}
