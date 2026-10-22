import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import { changeDeliveryMode, releaseDeliveryMode, releaseOrder } from "./delivery-mode-api";

afterEach(() => vi.restoreAllMocks());

describe("releaseOrder — POST /orders/{id}/release", () => {
  it("không có deliveryMode → body chỉ có warehouseId (BE giữ hình thức của đơn)", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: {} });
    await releaseOrder({ id: "o-1", warehouseId: "wh-1" });
    expect(post).toHaveBeenCalledWith("/orders/o-1/release", { warehouseId: "wh-1" });
  });

  it("có deliveryMode → gửi kèm", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: {} });
    await releaseOrder({ id: "o-1", warehouseId: "wh-1", deliveryMode: "FULL_TRUCKLOAD" });
    expect(post).toHaveBeenCalledWith("/orders/o-1/release", {
      warehouseId: "wh-1",
      deliveryMode: "FULL_TRUCKLOAD",
    });
  });

  it("id được mã hoá trong path", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: {} });
    await releaseOrder({ id: "a/b", warehouseId: "wh-1" });
    expect(post).toHaveBeenCalledWith("/orders/a%2Fb/release", { warehouseId: "wh-1" });
  });

  it("ghép với releaseDeliveryMode: chọn lại đúng hình thức hiện tại → không gửi", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: {} });
    await releaseOrder({
      id: "o-1",
      warehouseId: "wh-1",
      deliveryMode: releaseDeliveryMode("PARCEL", "PARCEL"),
    });
    expect(post.mock.calls[0]?.[1]).toEqual({ warehouseId: "wh-1" });
  });
});

describe("changeDeliveryMode — PUT /orders/{id}/delivery-mode", () => {
  it("gửi deliveryMode + note (khi có)", async () => {
    const put = vi.spyOn(api, "put").mockResolvedValue({ data: {} });
    await changeDeliveryMode({
      id: "o-1",
      deliveryMode: "FULL_TRUCKLOAD",
      note: "Khách lấy 2 container",
    });
    expect(put).toHaveBeenCalledWith("/orders/o-1/delivery-mode", {
      deliveryMode: "FULL_TRUCKLOAD",
      note: "Khách lấy 2 container",
    });
  });

  it("ghi chú trống → bỏ khỏi body", async () => {
    const put = vi.spyOn(api, "put").mockResolvedValue({ data: {} });
    await changeDeliveryMode({ id: "o-1", deliveryMode: "PARCEL", note: "" });
    expect(put).toHaveBeenCalledWith("/orders/o-1/delivery-mode", { deliveryMode: "PARCEL" });
  });
});
