import { describe, expect, it } from "vitest";

import {
  FIELD_ALIAS,
  FIELD_STEP_MAP,
  firstMessageForStep,
  stepForErrors,
} from "./wizard-field-map";

import type { FieldErrors } from "react-hook-form";
import type { SupplierCreateInput } from "@/features/supplier/types";

function err(message: string) {
  return {
    message,
    type: "validate",
  } as unknown as FieldErrors<SupplierCreateInput>[keyof SupplierCreateInput];
}

describe("wizard-field-map", () => {
  describe("FIELD_STEP_MAP", () => {
    it("covers every form field and BE alias", () => {
      expect(FIELD_STEP_MAP.name).toBe("profile");
      expect(FIELD_STEP_MAP.taxCode).toBe("profile");
      expect(FIELD_STEP_MAP.email).toBe("contact");
      expect(FIELD_STEP_MAP.phone).toBe("contact");
      expect(FIELD_STEP_MAP["address.street"]).toBe("address");
      expect(FIELD_STEP_MAP.address).toBe("address");
      expect(FIELD_STEP_MAP.paymentTerms).toBe("terms");
    });
  });

  describe("FIELD_ALIAS", () => {
    it("maps BE email/phone to FE fields", () => {
      expect(FIELD_ALIAS.email).toBe("contactEmail");
      expect(FIELD_ALIAS.phone).toBe("contactPhone");
    });
  });

  describe("stepForErrors", () => {
    it("returns earliest wizard step among errors", () => {
      const errs = {
        leadTimeDays: err("x"),
        name: err("y"),
      } as unknown as FieldErrors<SupplierCreateInput>;
      expect(stepForErrors(errs)).toBe("profile");
    });

    it("handles nested address errors", () => {
      const errs = {
        address: { street: err("bắt buộc") },
      } as unknown as FieldErrors<SupplierCreateInput>;
      expect(stepForErrors(errs)).toBe("address");
    });

    it("returns undefined when no mapped field", () => {
      expect(stepForErrors({} as FieldErrors<SupplierCreateInput>)).toBeUndefined();
    });
  });

  describe("firstMessageForStep", () => {
    it("returns first message of that step from fresh errs", () => {
      const errs = {
        name: { message: "Tên bắt buộc", type: "validate" },
        contactEmail: { message: "Email sai", type: "validate" },
      } as unknown as FieldErrors<SupplierCreateInput>;
      expect(firstMessageForStep(errs, "profile")).toBe("Tên bắt buộc");
      expect(firstMessageForStep(errs, "contact")).toBe("Email sai");
    });

    it("falls back when step has no error", () => {
      const errs = {} as FieldErrors<SupplierCreateInput>;
      expect(firstMessageForStep(errs, "address")).toBe("Kiểm tra lại địa chỉ");
    });
  });
});
