import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { inventoryItemKeys } from "@/lib/references/inventory-item-keys";
import { inventoryItemOptionKeys } from "@/lib/references/inventory-item-options";

describe("inventoryItemKeys", () => {
  it("invalidate `all` làm mới detail, danh sách và gợi ý ô chọn SKU", async () => {
    const qc = new QueryClient();
    const keys = [
      inventoryItemKeys.detail("a"),
      inventoryItemKeys.list({ page: 0, size: 10 }),
      inventoryItemOptionKeys.options("cup"),
    ];
    for (const key of keys) qc.setQueryData(key, {});
    await qc.invalidateQueries({ queryKey: inventoryItemKeys.all });
    for (const key of keys) expect(qc.getQueryState(key)?.isInvalidated).toBe(true);
  });
});
