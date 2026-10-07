import { describe, expect, it } from "vitest";

import { getLifecycleSteps } from "./lifecycle-helpers";

const stepOf = (status: Parameters<typeof getLifecycleSteps>[0], label: string) =>
  getLifecycleSteps(status).find((s) => s.label === label);

describe("getLifecycleSteps — 'Nhận một phần' là bước tuỳ đơn", () => {
  it("CLOSED: không đánh dấu đã qua 'Nhận một phần' (BE đóng thẳng SENT → CLOSED khi nhận đủ)", () => {
    expect(stepOf("CLOSED", "PARTIALLY_RECEIVED")).toMatchObject({ done: false, optional: true });
    expect(stepOf("CLOSED", "SENT")).toMatchObject({ done: true, optional: false });
    expect(stepOf("CLOSED", "CLOSED")).toMatchObject({ done: true, current: true });
  });

  it("PARTIALLY_RECEIVED: là bước hiện tại, không tuỳ đơn", () => {
    expect(stepOf("PARTIALLY_RECEIVED", "PARTIALLY_RECEIVED")).toMatchObject({
      done: true,
      current: true,
      optional: false,
    });
  });

  it("CLOSED_SHORT: chỉ đến từ nhận một phần → bước đó chắc chắn đã qua", () => {
    expect(stepOf("CLOSED_SHORT", "PARTIALLY_RECEIVED")).toMatchObject({
      done: true,
      optional: false,
    });
    expect(stepOf("CLOSED_SHORT", "CLOSED")).toMatchObject({ done: false });
  });

  it("SENT: bước nhận một phần phía trước là tuỳ đơn, chưa qua", () => {
    expect(stepOf("SENT", "PARTIALLY_RECEIVED")).toMatchObject({ done: false, optional: true });
  });
});
