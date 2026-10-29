/**
 * Fixture đúng hình BE `TrialLoadEstimateResponse` (sau khi interceptor bóc envelope; Jackson `non_null` đã bỏ key null):
 * `trial: true` + `vehicles` / `unplaced` / `meta` của ước tính, KHÔNG có id / nguồn / thời điểm. Hình học lấy từ
 * fixture `Layout` của F1.
 */

import { LAYOUT_40HC, UNPLACED_40HC } from "./layouts";

export function apiTrialEstimate(patch: Record<string, unknown> = {}) {
  return {
    trial: true,
    selectionMode: "SINGLE_TYPE",
    vehicleTypeIds: ["vt-40hc"],
    vehicles: [LAYOUT_40HC],
    unplaced: UNPLACED_40HC.map((line, index) => ({
      ...line,
      sourceRef: `T${index + 1}`,
      reason: index === 0 ? "NO_SPACE" : "TOO_LARGE",
      refs: Array.from({ length: line.quantity }, (_, n) => `T${index + 1}#${n + 1}`),
    })),
    meta: {
      budgetMillis: 5000,
      budgetExhausted: false,
      elapsedMillis: 812,
      placedBoxes: LAYOUT_40HC.boxes.length,
      unplacedBoxes: 3,
      kitWarnings: [],
    },
    ...patch,
  };
}
