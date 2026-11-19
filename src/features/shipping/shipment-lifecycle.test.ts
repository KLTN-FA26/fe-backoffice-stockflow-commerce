import { describe, expect, it } from "vitest";

import { FULFILLMENT_DELIVERY_CORRECTION_PERMISSIONS as CORRECTION } from "@/constants";

import { canCorrectOutcome } from "./shipment-lifecycle";

import type { ShipmentRow } from "./types";

const with_ = (...codes: string[]) => ({ can: (code: string) => codes.includes(code) });
const row = (status: ShipmentRow["status"]) => ({ status });

describe("canCorrectOutcome — sửa tay kết quả giao (docs 09 §4.3 bước 5)", () => {
  it("cần mã quyền sửa kết quả giao; không có thì không hiện, dù ở trạng thái nào", () => {
    expect(canCorrectOutcome(row("DELIVERED"), with_())).toBe(false);
    expect(canCorrectOutcome(row("DELIVERED"), with_("fulfillment-delivery-outcomes:UPDATE"))).toBe(
      false,
    );
  });

  it("có quyền: chỉ lô đã giao hoặc giao thất bại", () => {
    const actor = with_(CORRECTION.update);
    expect(canCorrectOutcome(row("DELIVERED"), actor)).toBe(true);
    expect(canCorrectOutcome(row("DELIVERY_FAILED"), actor)).toBe(true);
    for (const status of [
      "READY_TO_DISPATCH",
      "HANDED_OVER",
      "RETURNED",
      "CANCELLED",
      "UNKNOWN",
    ] as const) {
      expect(canCorrectOutcome(row(status), actor)).toBe(false);
    }
  });
});
