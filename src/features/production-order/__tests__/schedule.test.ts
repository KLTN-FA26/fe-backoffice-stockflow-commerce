import { describe, expect, it } from "vitest";

import { productionScheduleDto } from "../schedule-schemas";
import {
  byNeedByDate,
  byWindowStart,
  daysUntil,
  expectedAfterNeedBy,
  filterScheduledOrders,
  filterShortBatches,
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

  it("đợt thiếu của đơn chưa chọn kho xuất (BE bỏ shippingWarehouseId) vẫn parse được", () => {
    const { shippingWarehouseId, shippingWarehouseCode, ...noWarehouse } = shortBatch();
    void shippingWarehouseId;
    void shippingWarehouseCode;
    const parsed = productionScheduleDto.parse({ ...schedule(), shortBatches: [noWarehouse] });
    expect(parsed.shortBatches[0]?.shippingWarehouseId).toBeUndefined();
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

  describe("lọc chữ phía FE (BE không có tham số tìm kiếm)", () => {
    const none = { q: "", code: "", order: "" };
    const rows = [
      scheduledOrder(),
      scheduledOrder({
        id: "po-2",
        code: "PRD-20261121-0002",
        orderNumber: "SO-2026-0077",
        producerCode: "TANPHU",
        producerName: "Xưởng In Tân Phú",
        receivingWarehouseCode: "BDG",
      }),
    ];
    const ids = (list: { id: string }[]) => list.map((r) => r.id);

    it("không lọc → giữ mọi dòng", () => {
      expect(ids(filterScheduledOrders(rows, none))).toEqual(["po-1", "po-2"]);
      expect(filterShortBatches([shortBatch()], none)).toHaveLength(1);
    });

    it("search chính khớp mã, đơn bán, đơn vị, kho — không phân biệt hoa thường, bỏ khoảng trắng", () => {
      expect(ids(filterScheduledOrders(rows, { ...none, q: "  tân phú " }))).toEqual(["po-2"]);
      expect(ids(filterScheduledOrders(rows, { ...none, q: "bdg" }))).toEqual(["po-2"]);
      expect(ids(filterScheduledOrders(rows, { ...none, q: "so-2026-0042" }))).toEqual(["po-1"]);
    });

    it("search trong cột chỉ xét đúng cột đó, kết hợp AND với search chính", () => {
      expect(ids(filterScheduledOrders(rows, { ...none, code: "0077" }))).toEqual([]);
      expect(ids(filterScheduledOrders(rows, { ...none, order: "0077" }))).toEqual(["po-2"]);
      expect(ids(filterScheduledOrders(rows, { q: "minh", code: "", order: "0077" }))).toEqual([]);
    });

    it("đợt còn thiếu: search chính khớp SKU / kho, lọc đơn bán theo số đơn", () => {
      const batches = [
        shortBatch(),
        shortBatch({ deliveryBatchId: "b-2", orderNumber: "SO-X", lines: [] }),
      ];
      expect(filterShortBatches(batches, { q: "bag-009", order: "" })).toHaveLength(1);
      expect(filterShortBatches(batches, { q: "", order: "so-x" })[0]?.deliveryBatchId).toBe("b-2");
    });
  });
});
