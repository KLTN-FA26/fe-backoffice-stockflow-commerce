/**
 * Step 5C.3 — hồ sơ hàng tồn của SKU đã NGỪNG (biến thể OBSOLETE), qua mock adapter thật.
 * BE `InventoryItemsImpl.lockEditable` (#120/#121): GET vẫn đọc được; PUT logistics → 409
 * VARIANT_OBSOLETE, không đổi gì. `InventoryItemResponse` không có trạng thái biến thể nên FE chưa biết
 * trước để ẩn nút Sửa — BE là chốt chặn.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetInventoryPolicyStore } from "@/lib/api/mock-routes-inventory-policy";
import { resetVariantMockStore } from "@/lib/api/mock-routes-variants";

import { getInventoryItem, saveItemLogistics } from "../api";
import { logisticsToForm } from "../selectors";

const OBSOLETE_ITEM = "item-SKU-007-WHT-L";

vi.setConfig({ testTimeout: 30_000 });

beforeAll(() => activateMockAdapter());
beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  vi.spyOn(console, "info").mockImplementation(() => {});
  resetVariantMockStore();
  resetInventoryPolicyStore();
});
afterEach(() => vi.restoreAllMocks());

async function apiError(p: Promise<unknown>): Promise<ApiError> {
  const e = await p.then(
    () => null,
    (err: unknown) => err,
  );
  if (!(e instanceof ApiError)) throw new Error(`expected ApiError, got ${String(e)}`);
  return e;
}

describe("mock = BE: hồ sơ của SKU đã ngừng", () => {
  it("GET vẫn đọc được hồ sơ của biến thể OBSOLETE", async () => {
    const item = await getInventoryItem(OBSOLETE_ITEM);
    expect(item.sku).toBe("SKU-007-WHT-L");
  });

  it("PUT logistics cũng bị chặn như BE (cùng `lockEditable`)", async () => {
    const before = await getInventoryItem(OBSOLETE_ITEM);
    const e = await apiError(
      saveItemLogistics({
        id: OBSOLETE_ITEM,
        version: before.version,
        values: logisticsToForm(before.logistics),
      }),
    );
    expect([e.status, e.code]).toEqual([409, "VARIANT_OBSOLETE"]);
    expect(await getInventoryItem(OBSOLETE_ITEM)).toEqual(before);
  });
});
