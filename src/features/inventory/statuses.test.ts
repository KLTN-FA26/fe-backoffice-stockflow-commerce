import { describe, expect, it } from "vitest";

import { STOCK_ADJUSTMENT_STATUS } from "@/constants/statuses";

import { STATUS_LABEL_VI, toneOf } from "@/lib/status-map";

describe("canonical stock adjustment display", () => {
  it("maps exact backend statuses without changing existing ones", () => {
    expect(toneOf(STOCK_ADJUSTMENT_STATUS.PENDING_APPROVAL)).toBe("warning");
    expect(toneOf(STOCK_ADJUSTMENT_STATUS.POSTED)).toBe("positive");
    expect(toneOf(STOCK_ADJUSTMENT_STATUS.REJECTED)).toBe("danger");
    expect(toneOf(STOCK_ADJUSTMENT_STATUS.WITHDRAWN)).toBe("muted");
    expect(toneOf("Pending Approval")).toBe("warning");
    expect(toneOf("Confirmed")).toBe("positive");
    Object.values(STOCK_ADJUSTMENT_STATUS).forEach((status) =>
      expect(STATUS_LABEL_VI[status]).toBeTruthy(),
    );
  });
});
