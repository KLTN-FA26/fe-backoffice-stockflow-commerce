import { describe, expect, it } from "vitest";

import { supplierFormSchema } from "@/features/supplier/schemas";

import {
  FIELD_STEP_MAP,
  earliestStep,
  fieldsOfStep,
  firstMessageForStep,
  issuesByStep,
  stepForErrors,
} from "./wizard-field-map";

import type { FieldErrors } from "react-hook-form";
import type { SupplierFormValues } from "@/features/supplier/types";

const err = (message: string) => ({ message, type: "validate" });
const asErrors = (e: object) => e as FieldErrors<SupplierFormValues>;

describe("wizard-field-map", () => {
  it("mọi field của supplierFormSchema đều có bước (thêm field quên khai báo → test đỏ)", () => {
    for (const field of Object.keys(supplierFormSchema.shape)) {
      expect(FIELD_STEP_MAP, `thiếu "${field}"`).toHaveProperty([field]);
    }
  });

  it("wizard chỉ còn 3 bước, không còn bước địa chỉ", () => {
    expect(new Set(Object.values(FIELD_STEP_MAP))).toEqual(
      new Set(["profile", "contact", "terms"]),
    );
  });

  it("fieldsOfStep trả đúng field của bước", () => {
    expect(fieldsOfStep("profile")).toEqual(["code", "name", "taxCode"]);
    expect(fieldsOfStep("terms")).toContain("communicationChannel");
  });

  it("earliestStep / stepForErrors chọn bước sớm nhất", () => {
    expect(earliestStep(["apiEndpoint", "email"])).toBe("contact");
    expect(stepForErrors(asErrors({ leadTimeDays: err("x"), name: err("y") }))).toBe("profile");
    expect(stepForErrors(asErrors({}))).toBeUndefined();
  });

  it("firstMessageForStep đọc errs mới, có câu dự phòng", () => {
    const errs = asErrors({ name: err("Tên bắt buộc"), email: err("Email sai") });
    expect(firstMessageForStep(errs, "profile")).toBe("Tên bắt buộc");
    expect(firstMessageForStep(errs, "contact")).toBe("Email sai");
    expect(firstMessageForStep(asErrors({}), "terms")).toBe("Kiểm tra lại điều khoản");
  });

  it("issuesByStep gom lỗi theo bước", () => {
    const map = issuesByStep(
      asErrors({ code: err("a"), taxCode: err("b"), apiEndpoint: err("c") }),
    );
    expect(map.get("profile")).toEqual(["a", "b"]);
    expect(map.get("terms")).toEqual(["c"]);
    expect(map.has("contact")).toBe(false);
  });
});
