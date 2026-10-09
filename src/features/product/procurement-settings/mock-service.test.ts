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
    const draft = service.read("SKU-001-BLK-L", 60);
    draft.reorderPoint = 75;
    const result = await service.save(draft);
    draft.reorderPoint = 90;
    result.reorderPoint = 100;
    const firstSupplier = result.suppliers[0];
    if (!firstSupplier) throw new Error("Expected fixture supplier");
    firstSupplier.leadTimeDays = 5;
    expect(service.read(draft.skuId, 60)).toMatchObject({
      reorderPoint: 75,
      suppliers: expect.arrayContaining([expect.objectContaining({ leadTimeDays: null })]),
    });
    expect(service.read("SKU-001-BLK-M", 60).reorderPoint).toBe(60);
    expect(createProcurementMockService().read(draft.skuId, 60).reorderPoint).toBe(60);
  });

  it("reproducibly fails without replacing persisted data, then succeeds", async () => {
    let fail = true;
    const service = createProcurementMockService(async () => {
      if (fail) throw new Error("Mock save failed");
    });
    const draft = { ...service.read("SKU-001-BLK-L", 60), reorderPoint: 75 };
    await expect(service.save(draft)).rejects.toThrow("Mock save failed");
    expect(service.read(draft.skuId, 60).reorderPoint).toBe(60);
    fail = false;
    await expect(service.save(draft)).resolves.toMatchObject({ reorderPoint: 75 });
  });

  it("the public reader sees saved data and never saves outside mock mode", async () => {
    const draft = { ...readMockSkuProcurementSettings("SKU-001-BLK-M", 60), reorderPoint: 75 };
    await saveProcurementSettings(draft, true);
    expect(readSkuProcurementSettingsView(draft.skuId, 60, true).reorderPoint).toBe(75);
    await expect(saveProcurementSettings(draft, false)).rejects.toThrow("Chờ hợp đồng dữ liệu");
    expect(readSkuProcurementSettingsView(draft.skuId, 60, false).reorderPoint).toBeNull();
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
});
