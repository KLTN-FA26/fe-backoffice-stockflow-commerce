import { describe, expect, it } from "vitest";

import { switchWarehouseHref } from "./workspace";

const PAGES = [{ path: "" }, { path: "slotting" }, { path: "picking" }, { path: "putaway" }];

describe("đổi kho trên breadcrumb (spec §5.7)", () => {
  it("trang list giữ nguyên trang, đổi prefix", () => {
    expect(switchWarehouseHref("/admin/warehouse-map/BD/slotting", "HCM", PAGES)).toBe(
      "/admin/warehouse-map/HCM/slotting",
    );
  });

  it("bản đồ (gốc kho) → bản đồ kho mới", () => {
    expect(switchWarehouseHref("/admin/warehouse-map/BD", "HCM", PAGES)).toBe(
      "/admin/warehouse-map/HCM",
    );
  });

  it("trang chi tiết → về trang list cùng màn ở kho mới (bản ghi không có ở kho khác)", () => {
    expect(switchWarehouseHref("/admin/warehouse-map/BD/picking/t-1", "HCM", PAGES)).toBe(
      "/admin/warehouse-map/HCM/picking",
    );
    expect(switchWarehouseHref("/admin/warehouse-map/BD/putaway/trips/tr-9", "HCM", PAGES)).toBe(
      "/admin/warehouse-map/HCM/putaway",
    );
  });

  it("đoạn không thuộc trang nào → về bản đồ kho mới", () => {
    expect(switchWarehouseHref("/admin/warehouse-map/BD/lạ", "HCM", PAGES)).toBe(
      "/admin/warehouse-map/HCM",
    );
  });
});
