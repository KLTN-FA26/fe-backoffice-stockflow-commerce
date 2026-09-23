import { describe, expect, it } from "vitest";

import {
  paginatedSupplierDtoSchema,
  supplierCreateInputSchema,
  supplierDtoSchema,
} from "./schemas";

const validAddress = {
  street: "123 Nguyen Hue",
  ward: "Ben Nghe",
  district: "Quan 1",
  province: "TP.HCM",
  postalCode: "700000",
  country: "VN" as const,
};

describe("supplier schemas", () => {
  it("rejects invalid taxCode format", () => {
    expect(() =>
      supplierCreateInputSchema.parse({
        name: "A",
        taxCode: "123",
        contactName: "B",
        contactEmail: "a@b.vn",
        contactPhone: "0901234567",
        address: validAddress,
      }),
    ).toThrow();
    expect(
      supplierCreateInputSchema.safeParse({
        name: "A",
        taxCode: "0301234567",
        contactName: "B",
        contactEmail: "a@b.vn",
        contactPhone: "0901234567",
        address: validAddress,
      }).success,
    ).toBe(true);
    expect(
      supplierCreateInputSchema.safeParse({
        name: "A",
        taxCode: "0301234567-001",
        contactName: "B",
        contactEmail: "a@b.vn",
        contactPhone: "0901234567",
        address: validAddress,
      }).success,
    ).toBe(true);
  });

  it("rejects invalid phone", () => {
    const base = {
      name: "A",
      taxCode: "0301234567",
      contactName: "B",
      contactEmail: "a@b.vn",
      address: validAddress,
    };
    expect(supplierCreateInputSchema.safeParse({ ...base, contactPhone: "123" }).success).toBe(
      false,
    );
    expect(
      supplierCreateInputSchema.safeParse({ ...base, contactPhone: "0901234567" }).success,
    ).toBe(true);
  });

  it("accepts CNY currency (BR-07)", () => {
    expect(
      supplierDtoSchema.safeParse({
        supplierId: "SUP-001",
        name: "A",
        taxCode: "0301234567",
        contactName: "B",
        contactEmail: "a@b.vn",
        contactPhone: "0901234567",
        status: "Active",
        currency: "CNY",
      }).success,
    ).toBe(true);
  });

  it("rejects empty address field", () => {
    expect(
      supplierCreateInputSchema.safeParse({
        name: "A",
        taxCode: "0301234567",
        contactName: "B",
        contactEmail: "a@b.vn",
        contactPhone: "0901234567",
        address: {
          street: "",
          ward: "Ben Nghe",
          district: "Quan 1",
          province: "TP.HCM",
          postalCode: "700000",
          country: "VN" as const,
        },
      }).success,
    ).toBe(false);
  });

  it("validates paginated wrapper at the boundary", () => {
    expect(
      paginatedSupplierDtoSchema.safeParse({ items: [], total: 0, page: 1, pageSize: 15 }).success,
    ).toBe(true);
    expect(
      paginatedSupplierDtoSchema.safeParse({ items: [], total: 0, page: 0, pageSize: 15 }).success,
    ).toBe(false);
  });
});
