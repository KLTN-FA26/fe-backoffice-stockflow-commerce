import { describe, expect, it } from "vitest";

import { cartonLocationHref, isOpenTaskType, openTaskHref } from "./carton-selectors";

const ID = "0e380000-0000-4000-8000-000000000003";

describe("openTaskHref — việc đang làm trên thùng (docs 20 BR-10) mở trong tab Kho", () => {
  it.each([
    ["PUTAWAY", `/admin/warehouse-map/HCM/putaway/${ID}`],
    ["PICK", `/admin/warehouse-map/HCM/picking/${ID}`],
    // BE gửi id của task lấy hàng cho kiểm thùng — trạm kiểm thùng mở theo đúng id đó
    ["CARTON_CHECK", `/admin/warehouse-map/HCM/packing/${ID}`],
    ["CYCLE_COUNT", `/admin/warehouse-map/HCM/cycle-counts/${ID}`],
  ])("%s → %s", (type, href) => {
    expect(openTaskHref({ type, id: ID }, "HCM")).toBe(href);
  });

  it("loại việc lạ hoặc thiếu mã kho → không có link (chỉ hiện nhãn)", () => {
    expect(openTaskHref({ type: "NEW_TASK", id: ID }, "HCM")).toBeNull();
    expect(openTaskHref({ type: "PICK", id: ID }, null)).toBeNull();
  });

  it("isOpenTaskType chỉ nhận loại BE khai báo", () => {
    expect(isOpenTaskType("CYCLE_COUNT")).toBe(true);
    expect(isOpenTaskType("NEW_TASK")).toBe(false);
  });
});

describe("cartonLocationHref — vị trí của thùng trên Danh sách vị trí", () => {
  it("mở danh sách vị trí của kho, lọc sẵn đúng mã", () => {
    expect(cartonLocationHref("HCM", "HCM-A01-2-B")).toBe(
      "/admin/warehouse-map/HCM/locations?code=HCM-A01-2-B",
    );
  });

  it("thiếu kho hoặc vị trí → null", () => {
    expect(cartonLocationHref(null, "HCM-A01-2-B")).toBeNull();
    expect(cartonLocationHref("HCM", null)).toBeNull();
  });
});
