import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/error";

import { supplierErrorMessage, supplierFieldErrors } from "./errors";

const apiError = (status: number, code: string, message = "msg", fields?: Record<string, string>) =>
  new ApiError(status, code, message, fields);

describe("supplierErrorMessage — mọi lỗi hiển thị tiếng Việt", () => {
  it.each([
    ["SUPPLIER_CODE_ALREADY_EXISTS", "Mã nhà cung cấp đã tồn tại"],
    ["SUPPLIER_TAX_CODE_ALREADY_EXISTS", "Mã số thuế đã thuộc nhà cung cấp khác"],
    [
      "SUPPLIER_HAS_OPEN_PURCHASE_ORDERS",
      "Nhà cung cấp còn đơn đặt hàng đang mở, không thể ngừng hợp tác",
    ],
    ["SUPPLIER_NOT_FOUND", "Không tìm thấy nhà cung cấp"],
    ["CONFLICT", "Không được đổi mã nhà cung cấp sau khi tạo"],
  ])("%s → câu tiếng Việt", (code, expected) => {
    expect(
      supplierErrorMessage(apiError(409, code, "A supplier with this code already exists")),
    ).toBe(expected);
  });

  it("400 VALIDATION_FAILED có fieldErrors → nêu rõ trường sai bằng tiếng Việt (vd kích hoạt NCC seed sai MST)", () => {
    const err = apiError(400, "VALIDATION_FAILED", "Dữ liệu không hợp lệ", {
      taxCode: "sai định dạng",
    });
    expect(supplierErrorMessage(err)).toBe(
      "Mã số thuế: sai định dạng — cập nhật hồ sơ nhà cung cấp rồi thử lại",
    );
  });

  it("nhiều trường sai, kể cả trường ảo của BE → ghép từng trường", () => {
    const err = apiError(400, "VALIDATION_FAILED", "x", {
      taxCode: "sai định dạng",
      deliveryContactValid: "invalid",
    });
    expect(supplierErrorMessage(err)).toBe(
      "Mã số thuế: sai định dạng; Kênh gửi PO: Thông tin kênh gửi PO không hợp lệ — cập nhật hồ sơ nhà cung cấp rồi thử lại",
    );
  });

  it("lỗi không rõ, không phải ApiError → câu chung", () => {
    expect(supplierErrorMessage(new Error("boom"))).toBe("Dữ liệu không hợp lệ");
  });
});

describe("supplierFieldErrors — lỗi BE về đúng ô", () => {
  it("409 trùng MST (không có fieldErrors) → ô taxCode", () => {
    expect(supplierFieldErrors(apiError(409, "SUPPLIER_TAX_CODE_ALREADY_EXISTS"), "EMAIL")).toEqual(
      [{ field: "taxCode", message: "Mã số thuế đã thuộc nhà cung cấp khác" }],
    );
  });

  it("deliveryContactValid → ô email khi kênh EMAIL, ô apiEndpoint khi kênh API", () => {
    const err = apiError(400, "VALIDATION_FAILED", "x", { deliveryContactValid: "invalid" });
    expect(supplierFieldErrors(err, "EMAIL")[0]?.field).toBe("email");
    expect(supplierFieldErrors(err, "API")[0]?.field).toBe("apiEndpoint");
  });

  it("phoneDigitsValid → ô phone; field lạ bị bỏ qua", () => {
    const err = apiError(400, "VALIDATION_FAILED", "x", { phoneDigitsValid: "x", foo: "bar" });
    expect(supplierFieldErrors(err, "EMAIL")).toEqual([
      { field: "phone", message: "Số điện thoại phải có 8–15 chữ số" },
    ]);
  });
});
