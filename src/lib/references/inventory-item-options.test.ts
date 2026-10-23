import { beforeEach, describe, expect, it, vi } from "vitest";

import { INVENTORY_ITEM_OPTIONS_PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";

import { inventoryItemKeys } from "./inventory-item-keys";
import { fetchInventoryItemOptions, inventoryItemOptionKeys } from "./inventory-item-options";

vi.mock("@/lib/api/client", () => ({ api: { get: vi.fn() } }));

const getMock = vi.mocked(api.get);

/** Đúng hình `InventoryItemSummary` của BE (`InventoryItemController.list`). */
function summary(sku: string, barcode?: string) {
  return {
    id: `0b6f6a8e-0000-4000-8000-${sku.length.toString().padStart(12, "0")}`,
    sku,
    unitOfMeasure: "EACH",
    ...(barcode ? { barcode } : {}),
    storageClass: "NORMAL",
    trackingMode: "NONE",
    policyConfigured: false,
  };
}

function page(items: unknown[], hasNext = false) {
  return {
    items,
    page: 0,
    size: 20,
    totalElements: hasNext ? items.length + 1 : items.length,
    totalPages: hasNext ? 2 : 1,
    hasNext,
    hasPrevious: false,
  };
}

function sentParams(): URLSearchParams {
  const [, config] = getMock.mock.calls[0] ?? [];
  return new URLSearchParams(config?.params as URLSearchParams);
}

describe("inventory-item-options", () => {
  beforeEach(() => getMock.mockReset());

  it("gọi /inventory/items với q đã trim, page 0 và size cố định", async () => {
    getMock.mockResolvedValue({ data: page([]) });
    await fetchInventoryItemOptions("  sofa ");
    expect(getMock.mock.calls[0]?.[0]).toBe("/inventory/items");
    const params = sentParams();
    expect(params.get("q")).toBe("sofa");
    expect(params.get("page")).toBe("0");
    expect(params.get("size")).toBe(String(INVENTORY_ITEM_OPTIONS_PAGE_SIZE));
  });

  it("q rỗng (hoặc chỉ khoảng trắng) → không gửi q", async () => {
    getMock.mockResolvedValue({ data: page([]) });
    await fetchInventoryItemOptions("   ");
    expect(sentParams().has("q")).toBe(false);
  });

  it("parse InventoryItemSummary: barcode vắng (BE non_null) → null", async () => {
    getMock.mockResolvedValue({ data: page([summary("SOFA-01", "8930001"), summary("TEE-1")]) });
    const options = await fetchInventoryItemOptions("");
    expect(options.items).toEqual([
      { id: expect.any(String), sku: "SOFA-01", unitOfMeasure: "EACH", barcode: "8930001" },
      { id: expect.any(String), sku: "TEE-1", unitOfMeasure: "EACH", barcode: null },
    ]);
    expect(options.hasMore).toBe(false);
  });

  it("BE còn trang sau (hasNext) → hasMore", async () => {
    getMock.mockResolvedValue({ data: page([summary("SOFA-01")], true) });
    expect((await fetchInventoryItemOptions("sofa")).hasMore).toBe(true);
  });

  it("response sai hình → ném lỗi parse", async () => {
    getMock.mockResolvedValue({ data: page([{ sku: "X" }]) });
    await expect(fetchInventoryItemOptions("")).rejects.toThrow();
  });

  it("key options nằm dưới inventoryItemKeys.all", () => {
    expect(inventoryItemOptionKeys.options("sofa").slice(0, 1)).toEqual([...inventoryItemKeys.all]);
  });
});
