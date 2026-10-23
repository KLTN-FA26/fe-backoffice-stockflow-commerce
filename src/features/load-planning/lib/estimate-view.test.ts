import { describe, expect, it } from "vitest";

import { LOAD_ESTIMATE_LABELS } from "@/constants";

import { LayoutSchema } from "../schemas";

import { LAYOUT_40HC } from "../__fixtures__/layouts";
import {
  isBudgetExhausted,
  missingFieldsText,
  summarizeEstimate,
  totalUnplaced,
  unplacedReasonText,
  warningText,
} from "./estimate-view";

const meta = (budgetExhausted: boolean) => ({ budgetExhausted, kitWarnings: [] });
const unplaced = (reason: string, quantity = 1) => ({
  label: "A",
  partName: "A",
  origMm: { l: 1, w: 1, h: 1 },
  quantity,
  sourceRef: null,
  reason,
  refs: [],
});

describe("estimate-view", () => {
  it("totalUnplaced cộng số kiện của mọi nhóm", () => {
    expect(totalUnplaced([unplaced("NO_SPACE", 12), unplaced("TOO_LARGE", 3)])).toBe(15);
    expect(totalUnplaced([])).toBe(0);
  });

  it("summarizeEstimate: số xe, kiện, kiện chưa xếp từ unplaced", () => {
    const summary = summarizeEstimate({
      vehicles: [LayoutSchema.parse(LAYOUT_40HC)],
      unplaced: [unplaced("NO_SPACE", 12), unplaced("TOO_LARGE", 3)],
    });
    expect(summary.vehicles).toBe(1);
    expect(summary.pieces).toBe(LAYOUT_40HC.boxes.length);
    expect(summary.unplacedPieces).toBe(15);
    expect(summary.utilization).toBeGreaterThan(0);
  });

  it("'Dừng do hết thời gian tính': cờ meta HOẶC có kiện SEARCH_CUT_OFF", () => {
    expect(isBudgetExhausted({ meta: meta(true), unplaced: [] })).toBe(true);
    expect(isBudgetExhausted({ meta: meta(false), unplaced: [unplaced("SEARCH_CUT_OFF")] })).toBe(
      true,
    );
    expect(isBudgetExhausted({ meta: meta(false), unplaced: [unplaced("NO_SPACE")] })).toBe(false);
  });

  it("nhãn tiếng Việt, mã lạ rơi về chính mã", () => {
    expect(missingFieldsText(["lengthCm", "weightKg", "futureField"])).toBe(
      "chiều dài, khối lượng, futureField",
    );
    expect(unplacedReasonText("SEARCH_CUT_OFF")).toBe("Dừng do hết thời gian tính");
    expect(unplacedReasonText("TOO_LARGE")).toMatch(/Quá lớn/);
    expect(unplacedReasonText("FUTURE")).toBe("FUTURE");
    expect(warningText({ code: "UNIT_WEIGHT_UNKNOWN" })).toMatch(/khối lượng/);
    expect(warningText({ type: "SURPLUS_PARTS" })).toMatch(/kiện thừa/);
    expect(warningText({ code: "NEW" })).toBe("NEW");
    expect(LOAD_ESTIMATE_LABELS.advisory).toBe("Ước tính — chỉ để tham khảo");
  });
});
