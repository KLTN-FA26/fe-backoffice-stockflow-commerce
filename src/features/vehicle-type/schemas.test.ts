import { describe, expect, it } from "vitest";

import { apiVehicleType } from "./__fixtures__/vehicle-type";
import { beVehicleTypePageSchema, beVehicleTypeSchema } from "./schemas";

const wire = (overrides: Record<string, unknown> = {}) => ({ ...apiVehicleType(), ...overrides });

describe("beVehicleTypeSchema — BE PR #153 VehicleTypeResponse", () => {
  it("parse đủ trường; giá thuê vắng (BE bỏ trường null) → nullish", () => {
    const row = beVehicleTypeSchema.parse(wire());
    expect(row).toMatchObject({
      code: "20DC",
      kind: "CONTAINER",
      innerLengthMm: 5898,
      gussetMm: 100,
      preset: true,
      status: "ACTIVE",
      version: 0,
    });
    expect(row.rentalPrice).toBeUndefined();
  });

  it("BigDecimal đến dạng số hoặc chuỗi số đều thành number; NaN bị chặn", () => {
    expect(beVehicleTypeSchema.parse(wire({ maxPayloadKg: "28200.500" })).maxPayloadKg).toBe(
      28200.5,
    );
    expect(beVehicleTypeSchema.parse(wire({ rentalPrice: 1500000 })).rentalPrice).toBe(1500000);
    expect(beVehicleTypeSchema.safeParse(wire({ maxPayloadKg: "abc" })).success).toBe(false);
  });

  it("từ chối kind / status ngoài hợp đồng và thiếu version", () => {
    expect(beVehicleTypeSchema.safeParse(wire({ kind: "BOAT" })).success).toBe(false);
    expect(beVehicleTypeSchema.safeParse(wire({ status: "DELETED" })).success).toBe(false);
    expect(beVehicleTypeSchema.safeParse(wire({ version: undefined })).success).toBe(false);
  });

  it("trang BE PageResponse", () => {
    const page = beVehicleTypePageSchema.parse({
      items: [wire()],
      page: 0,
      size: 15,
      totalElements: 1,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    });
    expect(page.items).toHaveLength(1);
  });
});
