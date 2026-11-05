import { describe, expect, it } from "vitest";

import { clearLineErrors, lineErrorKey, removeLineErrors } from "./server-line-errors";

const errors = {
  [lineErrorKey(0, "quantity")]: "a",
  [lineErrorKey(1, "sku")]: "b",
  [lineErrorKey(2, "quantity")]: "c",
};

describe("server-line-errors", () => {
  it("sửa một dòng chỉ bỏ lỗi của dòng đó", () => {
    expect(clearLineErrors(errors, 1)).toEqual({ "0.quantity": "a", "2.quantity": "c" });
    // Dòng không có lỗi → giữ nguyên object (không render lại vô ích)
    expect(clearLineErrors(errors, 5)).toBe(errors);
  });

  it("xoá dòng: bỏ lỗi dòng đó, dồn chỉ số các dòng sau, giữ các dòng trước", () => {
    expect(removeLineErrors(errors, 1)).toEqual({ "0.quantity": "a", "1.quantity": "c" });
  });
});
