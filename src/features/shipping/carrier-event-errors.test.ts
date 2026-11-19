import { describe, expect, it } from "vitest";

import { SHIPPING_ERROR_MESSAGES, SHIPPING_EVENT_ERROR_MESSAGES } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { carrierEventErrorMessage } from "./carrier-event-errors";

describe("carrierEventErrorMessage", () => {
  it("mã riêng của màn sự kiện hãng", () => {
    expect(carrierEventErrorMessage(new ApiError(409, "CARRIER_EVENT_NOT_RESOLVABLE", "en"))).toBe(
      SHIPPING_EVENT_ERROR_MESSAGES.CARRIER_EVENT_NOT_RESOLVABLE,
    );
    expect(carrierEventErrorMessage(new ApiError(404, "CARRIER_EVENT_NOT_FOUND", "en"))).toBe(
      SHIPPING_EVENT_ERROR_MESSAGES.CARRIER_EVENT_NOT_FOUND,
    );
  });
  it("mã khác dùng bảng chung; lỗi lạ → câu chung", () => {
    expect(carrierEventErrorMessage(new Error("x"))).toBe(SHIPPING_ERROR_MESSAGES.generic);
  });
});
