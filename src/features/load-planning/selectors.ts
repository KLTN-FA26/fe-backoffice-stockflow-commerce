/** Số liệu tổng hợp từ các `Layout` — hàm thuần, không side effect. */

import { extentOf, volumeMm3 } from "./lib/dims";

import type { Layout } from "./types";

export interface LayoutSummary {
  vehicles: number;
  pieces: number;
  usedVolumeMm3: number;
  capacityMm3: number;
  /** usedVolumeMm3 / capacityMm3, 0..1; 0 khi chưa có xe. */
  utilization: number;
  usedWeightKg: number;
  payloadKg: number;
  unplacedPieces: number;
}

export function summarizeLayouts(layouts: readonly Layout[], unplacedPieces = 0): LayoutSummary {
  const sum = (pick: (layout: Layout) => number) =>
    layouts.reduce((total, layout) => total + pick(layout), 0);
  const usedVolumeMm3 = sum((l) => l.usedVolumeMm3);
  const capacityMm3 = sum((l) => volumeMm3(extentOf(l.innerMm)));
  return {
    vehicles: layouts.length,
    pieces: sum((l) => l.boxes.length),
    usedVolumeMm3,
    capacityMm3,
    utilization: capacityMm3 > 0 ? usedVolumeMm3 / capacityMm3 : 0,
    usedWeightKg: sum((l) => l.usedWeightKg),
    payloadKg: sum((l) => l.maxPayloadKg),
    unplacedPieces,
  };
}
