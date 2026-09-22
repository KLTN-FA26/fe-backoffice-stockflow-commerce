import { describe, expect, it } from "vitest";

import { computeSupplierStats, filterSupplierByStatus, supplierNameById } from "./selectors";

import type { SupplierDto } from "./types";

function makeSupplier(
  overrides: Partial<SupplierDto> & Pick<SupplierDto, "supplierId" | "name">,
): SupplierDto {
  return {
    taxCode: "0301234567",
    contactName: "Nguyen Van A",
    contactEmail: "a@example.vn",
    contactPhone: "0901234567",
    status: "Active",
    ...overrides,
  } as SupplierDto;
}

describe("supplier selectors", () => {
  describe("computeSupplierStats", () => {
    it("returns zeros for empty list", () => {
      expect(computeSupplierStats([])).toEqual({ total: 0, active: 0, inactive: 0, activeRate: 0 });
    });

    it("counts active/inactive and activeRate", () => {
      const list = [
        makeSupplier({ supplierId: "SUP-001", name: "A", status: "Active" }),
        makeSupplier({ supplierId: "SUP-002", name: "B", status: "Active" }),
        makeSupplier({ supplierId: "SUP-003", name: "C", status: "Inactive" }),
      ];
      expect(computeSupplierStats(list)).toEqual({
        total: 3,
        active: 2,
        inactive: 1,
        activeRate: 67,
      });
    });

    it("rounds activeRate", () => {
      const list = [
        makeSupplier({ supplierId: "SUP-001", name: "A", status: "Active" }),
        makeSupplier({ supplierId: "SUP-002", name: "B", status: "Inactive" }),
        makeSupplier({ supplierId: "SUP-003", name: "C", status: "Inactive" }),
      ];
      expect(computeSupplierStats(list).activeRate).toBe(33);
    });
  });

  describe("filterSupplierByStatus", () => {
    it("returns all when statuses empty", () => {
      const list = [makeSupplier({ supplierId: "SUP-001", name: "A" })];
      expect(filterSupplierByStatus(list, [])).toBe(list);
    });

    it("filters by selected statuses", () => {
      const list = [
        makeSupplier({ supplierId: "SUP-001", name: "A", status: "Active" }),
        makeSupplier({ supplierId: "SUP-002", name: "B", status: "Inactive" }),
      ];
      expect(filterSupplierByStatus(list, ["Active"]).map((s) => s.supplierId)).toEqual([
        "SUP-001",
      ]);
    });
  });

  describe("supplierNameById", () => {
    it("returns name when found, id fallback otherwise", () => {
      const list = [makeSupplier({ supplierId: "SUP-001", name: "Thanh Cong" })];
      expect(supplierNameById(list, "SUP-001")).toBe("Thanh Cong");
      expect(supplierNameById(list, "SUP-999")).toBe("SUP-999");
    });
  });
});
