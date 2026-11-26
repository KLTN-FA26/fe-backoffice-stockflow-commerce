import { describe, expect, it } from "vitest";

import {
  editBodyOf,
  editValuesOf,
  hasCapacityWarning,
  latestMailFailed,
  matchesProductionOrder,
  productionOrderTotals,
  receivingWarehouseCode,
  receivingWarehouseName,
  shortageFromMessage,
} from "../selectors";
import { productionOrder } from "../__fixtures__/production-order";

describe("production order selectors", () => {
  it("cộng số thùng / đã nhập / tổng cái của các dòng", () => {
    expect(productionOrderTotals(productionOrder())).toEqual({
      cartons: 14,
      receivedCartons: 0,
      totalUnits: 596,
    });
  });

  it("BR-25: cảnh báo khi vượt dự kiến hoặc vượt nếu duyệt hết; không có bảng thì không cảnh báo", () => {
    const base = productionOrder();
    expect(hasCapacityWarning(base)).toBe(false);
    const capacity = base.capacity ? { ...base.capacity, exceedsIfAllApproved: true } : null;
    expect(hasCapacityWarning(productionOrder({ capacity }))).toBe(true);
    expect(hasCapacityWarning(productionOrder({ capacity: null }))).toBe(false);
    expect(receivingWarehouseCode(productionOrder({ capacity: null }))).toBeNull();
  });

  it("body PUT chỉ gồm dòng đổi số thùng hoặc yêu cầu đóng gói", () => {
    const order = productionOrder();
    const values = editValuesOf(order);
    values.lines[0] = { ...values.lines[0], cartons: "8" };
    const body = editBodyOf(order, values);
    expect(body.lines).toEqual([
      { orderLineId: "ol-1", cartons: 8, packingRequirements: undefined },
    ]);
  });

  it("lý do tắt duyệt mẫu chỉ gửi khi đang tắt", () => {
    const order = productionOrder();
    const on = editBodyOf(order, { ...editValuesOf(order), sampleWaiverReason: "x" });
    expect(on.sampleWaiverReason).toBeUndefined();
    const off = editBodyOf(order, {
      ...editValuesOf(order),
      sampleApprovalRequired: false,
      sampleWaiverReason: "Đã in mẫu ở đơn trước",
    });
    expect(off.sampleWaiverReason).toBe("Đã in mẫu ở đơn trước");
  });

  it("tìm trong trang theo mã hoặc SKU, không phân biệt hoa thường", () => {
    expect(matchesProductionOrder(productionOrder(), "cup-002")).toBe(true);
    expect(matchesProductionOrder(productionOrder(), "prd-2026")).toBe(true);
    expect(matchesProductionOrder(productionOrder(), "khác")).toBe(false);
  });

  it("đọc số thùng còn thiếu từ message 409 EXCEEDS_SHORTAGE", () => {
    expect(shortageFromMessage("Batch 2 lacks 6 carton(s) of CUS-TEE-001")).toBe(6);
    expect(shortageFromMessage("other")).toBeNull();
  });
});

describe("tên kho nhận (FE#286)", () => {
  it("ưu tiên tên BE kèm sẵn; thiếu thì tên trong bảng sức chứa; thiếu nữa thì mã; không có gì thì null", () => {
    expect(
      receivingWarehouseName(
        productionOrder({ receivingWarehouseName: "Kho Hà Nội", receivingWarehouseCode: "HNI" }),
      ),
    ).toBe("Kho Hà Nội");
    const base = productionOrder({ receivingWarehouseName: null, receivingWarehouseCode: null });
    expect(receivingWarehouseName(base)).toBe(base.capacity?.board.warehouseName ?? null);
    expect(
      receivingWarehouseName(
        productionOrder({
          capacity: null,
          receivingWarehouseName: null,
          receivingWarehouseCode: "BDG",
        }),
      ),
    ).toBe("BDG");
    expect(
      receivingWarehouseName(
        productionOrder({
          capacity: null,
          receivingWarehouseName: null,
          receivingWarehouseCode: null,
        }),
      ),
    ).toBeNull();
  });
});

describe("latestMailFailed — thư gửi đơn vị sản xuất lỗi (BE#477)", () => {
  const message = (generation: number, attemptNumber: number, status: string) => ({
    message: "production_order_sent",
    status,
    attemptNumber,
    generation,
  });
  const dispatch = (channel: "EMAIL" | "PDF", items: ReturnType<typeof message>[]) => ({
    channel,
    slip: null,
    messages: { items, page: 0, size: 20, totalElements: items.length, totalPages: 1 },
  });

  it("lần gửi mới nhất lỗi → cảnh báo; gửi lại thành công sau đó → thôi cảnh báo", () => {
    expect(latestMailFailed(dispatch("EMAIL", [message(0, 1, "FAILED")]) as never)).toBe(true);
    expect(
      latestMailFailed(
        dispatch("EMAIL", [message(0, 1, "FAILED"), message(1, 1, "SENT")]) as never,
      ),
    ).toBe(false);
  });

  it("kênh PDF hoặc chưa có dữ liệu → không cảnh báo", () => {
    expect(latestMailFailed(dispatch("PDF", [message(0, 1, "FAILED")]) as never)).toBe(false);
    expect(latestMailFailed(undefined)).toBe(false);
  });
});
