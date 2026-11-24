import type { ItemLogistics, LogisticsFormValues } from "./types";

/** Logistics BE → giá trị form (mã vạch null thành chuỗi rỗng). Không còn số đo (BE #396, docs 01 BR-03). */
export function logisticsToForm(l: ItemLogistics): LogisticsFormValues {
  return {
    unitOfMeasure: l.unitOfMeasure,
    barcode: l.barcode ?? "",
    rotatable: l.rotatable,
  };
}
