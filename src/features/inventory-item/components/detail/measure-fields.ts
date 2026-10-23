import type { LogisticsFormValues } from "../../types";

/** Các ô số của form logistics (kích thước, khối lượng, số kiện / quy cách). */
export const LOGISTICS_MEASURES = [
  "weightKg",
  "lengthCm",
  "widthCm",
  "heightCm",
  "packageWeightKg",
  "packageLengthCm",
  "packageWidthCm",
  "packageHeightCm",
  "packageCount",
  "packSize",
] as const satisfies readonly (keyof LogisticsFormValues)[];
