import { describe, expect, it } from "vitest";

import { readMockSkuProcurementSettings } from "./mock-fixtures";
import { createProcurementMockService } from "./mock-service";
import {
  readProcurementSupplierChoices,
  readSkuProcurementSettingsView,
  saveProcurementSettings,
} from "./service";

describe("procurement mock interaction contract", () => {
  it("persists per SKU and returns independent snapshots", async () => {
    const service = createProcurementMockService();
    const draft = service.read("SKU-001-BLK-L");
    draft.defaultSupplierId = "SUP-003";
    const result = await service.save(draft);
    draft.defaultSupplierId = "SUP-002";
    result.defaultSupplierId = "SUP-004";
    const firstSupplier = result.suppliers[0];
    if (!firstSupplier) throw new Error("Expected fixture supplier");
    firstSupplier.leadTimeDays = 5;
    expect(service.read(draft.skuId)).toMatchObject({
      defaultSupplierId: "SUP-003",
      suppliers: expect.arrayContaining([expect.objectContaining({ leadTimeDays: null })]),
    });
    expect(service.read("SKU-001-BLK-M").defaultSupplierId).toBeNull();
    expect(createProcurementMockService().read(draft.skuId).defaultSupplierId).toBe("SUP-001");
  });

  it("reproducibly fails without replacing persisted data, then succeeds", async () => {
    let fail = true;
    const service = createProcurementMockService(async () => {
      if (fail) throw new Error("Mock save failed");
    });
    const draft = { ...service.read("SKU-001-BLK-L"), defaultSupplierId: "SUP-003" };
    await expect(service.save(draft)).rejects.toThrow("Mock save failed");
    expect(service.read(draft.skuId).defaultSupplierId).toBe("SUP-001");
    fail = false;
    await expect(service.save(draft)).resolves.toMatchObject({ defaultSupplierId: "SUP-003" });
  });

  it("the public reader sees saved data and never saves outside mock mode", async () => {
    const draft = {
      ...readMockSkuProcurementSettings("SKU-001-BLK-M"),
      defaultSupplierId: "SUP-003",
    };
    await saveProcurementSettings(draft, true);
    expect(readSkuProcurementSettingsView(draft.skuId, true).defaultSupplierId).toBe("SUP-003");
    await expect(saveProcurementSettings(draft, false)).rejects.toThrow("Chờ hợp đồng dữ liệu");
    expect(readSkuProcurementSettingsView(draft.skuId, false).defaultSupplierId).toBeNull();
    expect(readProcurementSupplierChoices(false)).toEqual([]);
  });

  it("offers supplier identities independently of mapping membership and master terms", () => {
    const choices = readProcurementSupplierChoices(true);
    expect(choices).toContainEqual({
      supplierId: "SUP-003",
      supplierName: "Công ty CP Gốm sứ Minh Long",
    });
    expect(choices[0]).not.toHaveProperty("leadTimeDays");
    expect(choices[0]).not.toHaveProperty("packSize");
    expect(choices[0]).not.toHaveProperty("isPreferred");
  });

  it("excludes Inventory Control state even when a caller supplies extra fields", async () => {
    const service = createProcurementMockService();
    const fixture = service.read("SKU-001-BLK-L");
    expect(fixture).not.toHaveProperty("reorderPoint");
    const caller = { ...fixture, reorderPoint: 75 };
    const accepted = await service.save(caller);
    expect(accepted).not.toHaveProperty("reorderPoint");
    expect(service.read(caller.skuId)).not.toHaveProperty("reorderPoint");
    expect(caller.reorderPoint).toBe(75);
  });
});
