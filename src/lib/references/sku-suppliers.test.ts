import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import { fetchSkuSuppliers, skuSupplierKeys } from "./sku-suppliers";
import { supplierItemKeys } from "./supplier-items";

vi.mock("@/lib/api/client", () => ({ api: { get: vi.fn() } }));

const getMock = vi.mocked(api.get);

const row = (overrides: Record<string, unknown> = {}) => ({
  supplierId: "S1",
  supplierCode: "GOVIET",
  supplierName: "Xưởng gỗ Việt",
  supplierStatus: "ACTIVE",
  supplierItemId: "si-1",
  price: "5000000.00",
  currency: "VND",
  moq: 2,
  packSize: 1,
  effectiveLeadTimeDays: 14,
  preferred: true,
  ...overrides,
});

describe("sku-suppliers (BE GET /procurement/skus/{sku}/suppliers)", () => {
  beforeEach(() => getMock.mockReset());

  it("gọi đúng path, mã SKU được encode; supplierSkuCode vắng (non_null) → null", async () => {
    getMock.mockResolvedValueOnce({ data: [row()] });
    const [first] = await fetchSkuSuppliers("SOFA 3S");
    expect(getMock.mock.calls[0]?.[0]).toBe("/procurement/skus/SOFA%203S/suppliers");
    expect(first).toMatchObject({ supplierId: "S1", price: 5000000, supplierSkuCode: null });
  });

  it("key nằm dưới supplierItemKeys.all (mutation danh mục làm mới luôn)", () => {
    expect(skuSupplierKeys.bySku("SKU-A").slice(0, 2)).toEqual([...supplierItemKeys.all]);
  });
});
