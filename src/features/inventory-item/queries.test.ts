import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { inventoryItemKeys } from "@/lib/references/inventory-item-keys";

describe("inventoryItemKeys", () => {
  it("tóm tắt và detail khác khoá — không đọc nhầm hình dữ liệu của nhau", () => {
    expect(inventoryItemKeys.summary("a")).not.toEqual(inventoryItemKeys.detail("a"));
  });

  it("invalidate `all` làm mới cả tóm tắt, detail và danh sách", async () => {
    const qc = new QueryClient();
    qc.setQueryData(inventoryItemKeys.summary("a"), { id: "a" });
    qc.setQueryData(inventoryItemKeys.detail("a"), { id: "a" });
    qc.setQueryData(inventoryItemKeys.list({ page: 0, size: 10 }), {});
    await qc.invalidateQueries({ queryKey: inventoryItemKeys.all });
    for (const key of [
      inventoryItemKeys.summary("a"),
      inventoryItemKeys.detail("a"),
      inventoryItemKeys.list({ page: 0, size: 10 }),
    ])
      expect(qc.getQueryState(key)?.isInvalidated).toBe(true);
  });
});
