/**
 * Step 5C.3 — hồ sơ hàng tồn của SKU đã NGỪNG (biến thể OBSOLETE), qua mock adapter thật.
 * BE `InventoryItemsImpl.lockEditable` (#120/#121): GET vẫn đọc được; PUT policy / logistics → 409
 * VARIANT_OBSOLETE, hỏi TRƯỚC version (khác 409 OPTIMISTIC_LOCK), không đổi gì. `InventoryItemResponse` không
 * có trạng thái biến thể nên FE chưa biết trước để ẩn nút Sửa — BE là chốt chặn; form phải giữ bản nháp,
 * báo rõ, không báo thành công, không tự gửi lại.
 */
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { INVENTORY_ITEM_ERROR_MESSAGES as E, UI_LABELS } from "@/constants";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetInventoryPolicyStore } from "@/lib/api/mock-routes-inventory-policy";
import { resetVariantMockStore } from "@/lib/api/mock-routes-variants";
import { toast } from "@/components/shared/Toast";

import { ITEM_PERMISSION_SETS, renderInventoryScreen } from "../__fixtures__/render";
import { getInventoryItem, saveItemLogistics, saveItemPolicy } from "../api";
import { logisticsToForm, policyToForm } from "../selectors";
import { InventoryItemDetail } from "./detail/InventoryItemDetail";

const L = UI_LABELS.inventoryItem;
const OBSOLETE_ITEM = "item-SKU-007-WHT-L";
const ACTIVE_ITEM = "item-SKU-001-BLK-M";

vi.setConfig({ testTimeout: 30_000 });
const WAIT = { timeout: 5_000 };
const passThrough = api.get.bind(api);

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
  it("GET vẫn đọc được chính sách của biến thể OBSOLETE", async () => {
    const item = await getInventoryItem(OBSOLETE_ITEM);
    expect(item.sku).toBe("SKU-007-WHT-L");
    expect(item.policy.removalStrategy).toMatch(/FIFO|FEFO/);
  });

  it("PUT policy → 409 VARIANT_OBSOLETE (hỏi trước version: version sai vẫn ra VARIANT_OBSOLETE), không đổi gì", async () => {
    const before = await getInventoryItem(OBSOLETE_ITEM);
    const values = { ...policyToForm(before.policy), reorderPoint: "40" };
    for (const version of [before.version, before.version + 7]) {
      const e = await apiError(saveItemPolicy({ id: OBSOLETE_ITEM, version, values }));
      expect([e.status, e.code]).toEqual([409, "VARIANT_OBSOLETE"]);
    }
    expect(await getInventoryItem(OBSOLETE_ITEM)).toEqual(before);
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

  it("biến thể còn dùng: lưu FIFO / FEFO + theo dõi lô bình thường", async () => {
    const before = await getInventoryItem(ACTIVE_ITEM);
    const saved = await saveItemPolicy({
      id: ACTIVE_ITEM,
      version: before.version,
      values: {
        ...policyToForm(before.policy),
        removalStrategy: "FEFO",
        trackingMode: "LOT",
        expiryTracked: true,
        maxShelfLifeDays: "90",
      },
    });
    expect(saved.version).toBe(before.version + 1);
    expect(saved.policy).toMatchObject({
      removalStrategy: "FEFO",
      trackingMode: "LOT",
      expiryTracked: true,
    });
  });
});

describe("form chính sách gặp VARIANT_OBSOLETE", () => {
  function signIn() {
    const get = vi.spyOn(api, "get").mockImplementation(async (url, config) =>
      url === "/identity/me/permissions"
        ? {
            data: {
              roles: ["TEST"],
              permissions: [...ITEM_PERMISSION_SETS.editor],
              dataScope: "ALL",
            },
          }
        : passThrough(url, config),
    );
    const put = vi.spyOn(api, "put");
    const success = vi.spyOn(toast, "success");
    return { get, put, success };
  }

  async function editReorderPoint(value: string) {
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: L.editPolicy }, WAIT));
    const reorder = screen.getByLabelText(L.field.reorderPoint);
    await user.clear(reorder);
    await user.type(reorder, value);
    await user.click(screen.getByRole("button", { name: L.savePolicy }));
    return user;
  }

  it("SKU đã ngừng: lưu → báo VARIANT_OBSOLETE, giữ bản nháp + form mở, không báo thành công, không gửi lại", async () => {
    const { put, success } = signIn();
    renderInventoryScreen(<InventoryItemDetail id={OBSOLETE_ITEM} />);
    await editReorderPoint("40");

    expect(await screen.findByText(E.VARIANT_OBSOLETE, {}, WAIT)).toBeInTheDocument();
    expect(screen.queryByText(E.OPTIMISTIC_LOCK)).toBeNull();
    expect(screen.getByLabelText(L.field.reorderPoint)).toHaveValue("40");
    expect(screen.getByRole("button", { name: L.savePolicy })).toBeInTheDocument();
    expect(put.mock.calls.filter(([url]) => String(url).endsWith("/policy"))).toHaveLength(1);
    expect(success).not.toHaveBeenCalled();
  });

  it("biến thể bị ngừng TRONG LÚC đang sửa → BE từ chối khi lưu; không nhầm với OPTIMISTIC_LOCK", async () => {
    const { get, put, success } = signIn();
    renderInventoryScreen(<InventoryItemDetail id={ACTIVE_ITEM} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: L.editPolicy }, WAIT));
    // người khác ngừng biến thể (route mock thật) — version hồ sơ không đổi
    await api.post("/products/PRD-001/variants/SKU-001-BLK-M/obsoletion");
    const itemGets = () =>
      get.mock.calls.filter(([url]) => url === `/inventory/items/${ACTIVE_ITEM}`).length;
    const getsBefore = itemGets();
    const reorder = screen.getByLabelText(L.field.reorderPoint);
    await user.clear(reorder);
    await user.type(reorder, "35");
    await user.click(screen.getByRole("button", { name: L.savePolicy }));

    expect(await screen.findByText(E.VARIANT_OBSOLETE, {}, WAIT)).toBeInTheDocument();
    expect(screen.queryByText(E.OPTIMISTIC_LOCK)).toBeNull();
    expect(screen.getByLabelText(L.field.reorderPoint)).toHaveValue("35");
    expect(put.mock.calls.filter(([url]) => String(url).endsWith("/policy"))).toHaveLength(1);
    expect(success).not.toHaveBeenCalled();
    // không phải lỗi "dữ liệu cũ": không tự tải lại hồ sơ để nạp đè bản nháp
    await waitFor(() => expect(itemGets()).toBe(getsBefore));
  });
});
