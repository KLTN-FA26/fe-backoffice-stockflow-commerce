import { describe, expect, it } from "vitest";

import { addressVNSchema, supplierCreateInputSchema } from "@/features/supplier/schemas";

import {
  FIELD_ALIAS,
  FIELD_STEP_MAP,
  firstMessageForStep,
  resolveServerFieldErrors,
  stepForErrors,
} from "./wizard-field-map";

import type { FieldErrors } from "react-hook-form";
import type { SupplierCreateInput } from "@/features/supplier/types";

const err = (message: string) => ({ message, type: "validate" });
const asErrors = (e: object) => e as FieldErrors<SupplierCreateInput>;

describe("wizard-field-map", () => {
  describe("FIELD_STEP_MAP", () => {
    it("mọi field của supplierCreateInputSchema (kể cả address.*) đều có bước", () => {
      const topLevel = Object.keys(supplierCreateInputSchema.shape);
      const nested = Object.keys(addressVNSchema.shape).map((k) => `address.${k}`);
      for (const path of [...topLevel, ...nested]) {
        expect(FIELD_STEP_MAP, `thiếu "${path}"`).toHaveProperty([path]);
      }
    });

    it("alias BE trỏ tới field FE có trong map", () => {
      expect(FIELD_ALIAS.email).toBe("contactEmail");
      expect(FIELD_ALIAS.phone).toBe("contactPhone");
      for (const target of Object.values(FIELD_ALIAS)) {
        expect(FIELD_STEP_MAP).toHaveProperty([target]);
      }
    });
  });

  describe("stepForErrors", () => {
    it("trả bước sớm nhất trong wizard", () => {
      expect(stepForErrors(asErrors({ leadTimeDays: err("x"), name: err("y") }))).toBe("profile");
    });

    it("xử lý lỗi address lồng", () => {
      expect(stepForErrors(asErrors({ address: { street: err("bắt buộc") } }))).toBe("address");
    });

    it("undefined khi không có field nào khớp map", () => {
      expect(stepForErrors(asErrors({}))).toBeUndefined();
    });
  });

  describe("firstMessageForStep", () => {
    it("lấy message đầu tiên của bước từ errs mới", () => {
      const errs = asErrors({ name: err("Tên bắt buộc"), contactEmail: err("Email sai") });
      expect(firstMessageForStep(errs, "profile")).toBe("Tên bắt buộc");
      expect(firstMessageForStep(errs, "contact")).toBe("Email sai");
    });

    it("đọc được message lồng trong address", () => {
      const errs = asErrors({ address: { ward: err("Phường bắt buộc") } });
      expect(firstMessageForStep(errs, "address")).toBe("Phường bắt buộc");
    });

    it("fallback khi bước không có lỗi", () => {
      expect(firstMessageForStep(asErrors({}), "address")).toBe("Kiểm tra lại địa chỉ");
    });
  });

  describe("resolveServerFieldErrors", () => {
    it("409 trùng taxCode → ô taxCode, bước profile", () => {
      expect(resolveServerFieldErrors({ taxCode: "MST trùng" })).toEqual({
        fields: [{ path: "taxCode", message: "MST trùng" }],
        step: "profile",
      });
    });

    it("chọn bước sớm nhất bất kể thứ tự key server trả về", () => {
      const r = resolveServerFieldErrors({ email: "Email trùng", code: "Mã trùng" });
      expect(r.step).toBe("profile");
    });

    it("map alias BE và path lồng", () => {
      const r = resolveServerFieldErrors({ phone: "SĐT sai", "address.street": "Thiếu đường" });
      expect(r.fields).toEqual([
        { path: "contactPhone", message: "SĐT sai" },
        { path: "address.street", message: "Thiếu đường" },
      ]);
      expect(r.step).toBe("contact");
    });

    it("bỏ qua field lạ (vd deliveryContactValid)", () => {
      expect(resolveServerFieldErrors({ deliveryContactValid: "x" })).toEqual({
        fields: [],
        step: undefined,
      });
    });
  });
});
