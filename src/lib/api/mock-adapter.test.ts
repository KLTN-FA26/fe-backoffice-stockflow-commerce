import { describe, expect, it } from "vitest";

import { serializeMockParams } from "./mock-adapter";

/**
 * Regression cho bug: axios KHÔNG serialize `config.params` vào `config.url`
 * cho custom adapter (chỉ built-in adapter mới làm việc này) — nên trước khi
 * có `serializeMockParams`, mọi route mock đọc `config.url?.split("?")[1]`
 * luôn thấy query string rỗng. Filter theo status trên `/admin/orders` (và
 * mọi filter khác dựa trên params) im lặng không hoạt động.
 */
describe("serializeMockParams", () => {
  it("bỏ qua params rỗng/undefined/null", () => {
    expect(serializeMockParams(undefined)).toBe("");
    expect(serializeMockParams(null)).toBe("");
    expect(serializeMockParams({})).toBe("");
    expect(serializeMockParams({ q: undefined, status: null, page: "" })).toBe("");
  });

  it("serialize giá trị scalar", () => {
    const search = new URLSearchParams(serializeMockParams({ q: "PO-2026", page: 2 }));
    expect(search.get("q")).toBe("PO-2026");
    expect(search.get("page")).toBe("2");
  });

  it("serialize mảng thành key lặp lại — khớp params.getAll(key) ở route handler", () => {
    const query = serializeMockParams({ status: ["Draft", "Confirmed"] });
    const search = new URLSearchParams(query);
    expect(search.getAll("status")).toEqual(["Draft", "Confirmed"]);
  });

  it("bỏ qua phần tử rỗng trong mảng nhưng giữ phần tử hợp lệ", () => {
    const search = new URLSearchParams(serializeMockParams({ status: ["Draft", "", null] }));
    expect(search.getAll("status")).toEqual(["Draft"]);
  });
});
