import { describe, expect, it } from "vitest";

import { getLifecycleSteps } from "./lifecycle-helpers";

const stepOf = (status: Parameters<typeof getLifecycleSteps>[0], label: string) =>
  getLifecycleSteps(status).find((s) => s.label === label);

describe("getLifecycleSteps — các bước nhận hàng là tuỳ đơn", () => {
  it("CLOSED: không khẳng định đã qua 'Nhận một phần' / 'Đã nhận đủ' (đóng thiếu hoặc nhận đủ)", () => {
    expect(stepOf("CLOSED", "PARTIALLY_RECEIVED")).toMatchObject({ done: false, optional: true });
    expect(stepOf("CLOSED", "RECEIVED")).toMatchObject({ done: false, optional: true });
    expect(stepOf("CLOSED", "CONFIRMED")).toMatchObject({ done: true, optional: false });
    expect(stepOf("CLOSED", "CLOSED")).toMatchObject({ done: true, current: true });
  });

  it("PARTIALLY_RECEIVED: là bước hiện tại, không tuỳ đơn", () => {
    expect(stepOf("PARTIALLY_RECEIVED", "PARTIALLY_RECEIVED")).toMatchObject({
      done: true,
      current: true,
      optional: false,
    });
  });

  it("PENDING_APPROVAL nằm giữa DRAFT và APPROVED trên trục chính", () => {
    expect(getLifecycleSteps("PENDING_APPROVAL").map((s) => s.label)).toEqual([
      "DRAFT",
      "PENDING_APPROVAL",
      "APPROVED",
      "CONFIRMED",
      "PARTIALLY_RECEIVED",
      "RECEIVED",
      "CLOSED",
    ]);
    expect(stepOf("PENDING_APPROVAL", "DRAFT")).toMatchObject({ done: true });
    expect(stepOf("PENDING_APPROVAL", "APPROVED")).toMatchObject({ done: false });
  });

  it("CONFIRMED: các bước nhận hàng phía trước là tuỳ đơn, chưa qua", () => {
    expect(stepOf("CONFIRMED", "PARTIALLY_RECEIVED")).toMatchObject({
      done: false,
      optional: true,
    });
  });
});
