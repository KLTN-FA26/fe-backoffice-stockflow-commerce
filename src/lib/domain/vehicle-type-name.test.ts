import { describe, expect, it } from "vitest";

import { vehicleTypeName } from "./vehicle-type-name";

const T125 = { code: "TRUCK-1T25", name: "Box truck 1.25 t (xe tải 1,25 tấn)" };
const PICKUP = { code: "PICKUP", name: "Pickup truck (xe bán tải)" };
const DC20 = { code: "20DC", name: "Container 20' Dry (20DC)" };

describe("vehicleTypeName", () => {
  it("takes the Vietnamese phrase in brackets, capitalised", () => {
    expect(vehicleTypeName(T125)).toBe("Xe tải 1,25 tấn");
    expect(vehicleTypeName(PICKUP)).toBe("Xe bán tải");
  });
  it("drops a bracket that only repeats the code", () => {
    expect(vehicleTypeName(DC20)).toBe("Container 20' Dry");
  });
  it("keeps a name without brackets", () => {
    expect(vehicleTypeName({ code: "X", name: "Xe tải nhỏ" })).toBe("Xe tải nhỏ");
  });

  it("keeps the full name when the bracket is a real part of it, not a translation", () => {
    for (const [code, name] of [
      ["T125", "Xe tải 1,25 tấn (thùng bạt)"],
      ["C20", "Container (20ft)"],
      ["CR", "Xe cẩu (crane)"],
      ["A", "Truck (Tuyến A)"],
      ["B", "Xe tải (xe tải)"],
    ] as const)
      expect(vehicleTypeName({ code, name })).toBe(name);
  });
});
