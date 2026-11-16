import { formatFixed } from "@/lib/format";

/** Millimetres with one decimal, as every size of the screen is shown ("90,0 mm"); a half-typed value shows a dash. */
export const formatMm = (value: number): string =>
  Number.isFinite(value) ? `${formatFixed(value, 1)} mm` : "—";
