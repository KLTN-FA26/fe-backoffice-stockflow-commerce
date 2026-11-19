import { describe, expect, it } from "vitest";

import { productionScheduleDto } from "../schedule-schemas";
import {
  byNeedByDate,
  byWindowStart,
  daysUntil,
  expectedAfterNeedBy,
  sortFlags,
} from "../schedule-selectors";
import { schedule, scheduledOrder, shortBatch } from "../__fixtures__/schedule";

describe("lịch sản xuất (docs 17 §4.12 bước 47)", () => {
  it("parse hợp đồng BE; alerts vắng → mảng rỗng", () => {
    const { alerts, ...noAlerts } = scheduledOrder();
    void alerts;
    const parsed = productionScheduleDto.parse({ ...schedule(), productionOrders: [noAlerts] });
    expect(parsed.productionOrders[0]?.alerts).toEqual([]);
  });

  it("Đơn sản xuất xếp theo ngày cần hàng, cùng ngày theo mã", () => {
    const rows = byNeedByDate([
      scheduledOrder({ id: "b", code: "PRD-B", needByDate: "2026-12-10" }),
      scheduledOrder({ id: "c", code: "PRD-C", needByDate: "2026-12-01" }),
      scheduledOrder({ id: "a", code: "PRD-A", needByDate: "2026-12-10" }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["c", "a", "b"]);
  });

  it("đợt còn thiếu: cửa sổ giao sớm nhất trước, đợt chưa có cửa sổ cuối", () => {
    const rows = byWindowStart([
      shortBatch({ deliveryBatchId: "x", windowStart: null }),
      shortBatch({ deliveryBatchId: "y", windowStart: "2026-12-20" }),
      shortBatch({ deliveryBatchId: "z", windowStart: "2026-12-02" }),
    ]);
    expect(rows.map((r) => r.deliveryBatchId)).toEqual(["z", "y", "x"]);
  });

  it("đếm ngày tới ngày cần hàng theo lịch, âm = đã quá", () => {
    expect(daysUntil("2026-12-10", "2026-12-01")).toBe(9);
    expect(daysUntil("2026-11-18", "2026-11-20")).toBe(-2);
    expect(daysUntil("2026-11-20", "2026-11-20")).toBe(0);
  });

  it("AT_RISK: ngày dự kiến muộn hơn ngày cần hàng (bước 48)", () => {
    expect(expectedAfterNeedBy(scheduledOrder())).toBe(true);
    expect(expectedAfterNeedBy(scheduledOrder({ expectedCompletionDate: "2026-12-09" }))).toBe(
      false,
    );
    expect(expectedAfterNeedBy(scheduledOrder({ expectedCompletionDate: null }))).toBe(false);
  });

  it("cờ trễ thật lên trước nguy cơ", () => {
    const flags = sortFlags([
      { alertId: "1", type: "AT_RISK", openedAt: "2026-11-01T00:00:00Z" },
      { alertId: "2", type: "PRODUCTION_LATE", openedAt: "2026-11-05T00:00:00Z" },
    ]);
    expect(flags.map((f) => f.type)).toEqual(["PRODUCTION_LATE", "AT_RISK"]);
  });
});
