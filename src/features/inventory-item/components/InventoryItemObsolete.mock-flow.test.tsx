/**
 * Step 5C.3 — hồ sơ hàng tồn của SKU đã NGỪNG (biến thể OBSOLETE), qua mock adapter thật.
 * BE `InventoryItemsImpl.lockEditable`: GET vẫn đọc được; PUT logistics → 409 VARIANT_OBSOLETE, hỏi TRƯỚC
 * version (khác 409 OPTIMISTIC_LOCK), không đổi gì. `InventoryItemResponse` không có trạng thái biến thể nên
 * FE chưa biết trước để ẩn nút Sửa — BE là chốt chặn; form phải giữ bản nháp, báo rõ, không báo thành công,
 * không tự gửi lại.
 */
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { INVENTORY_ITEM_ERROR_MESSAGES as E, UI_LABELS } from "@/constants";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetVariantMockStore } from "@/lib/api/mock-routes-variants";
import { toast } from "@/components/shared/Toast";

import { ITEM_PERMISSION_SETS, renderInventoryScreen } from "../__fixtures__/render";
import { getInventoryItem, saveItemLogistics } from "../api";
import { logisticsToForm } from "../selectors";
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
  it("GET vẫn đọc được logistics của biến thể OBSOLETE", async () => {
    const item = await getInventoryItem(OBSOLETE_ITEM);
    expect(item.sku).toBe("SKU-007-WHT-L");
    expect(item.logistics.unitOfMeasure).toBeTruthy();
  });

  it("PUT logistics → 409 VARIANT_OBSOLETE (hỏi trước version: version sai vẫn ra VARIANT_OBSOLETE), không đổi gì", async () => {
    const before = await getInventoryItem(OBSOLETE_ITEM);
    const values = { ...logisticsToForm(before.logistics), barcode: "8939999999909" };
    for (const version of [before.version, before.version + 7]) {
      const e = await apiError(saveItemLogistics({ id: OBSOLETE_ITEM, version, values }));
      expect([e.status, e.code]).toEqual([409, "VARIANT_OBSOLETE"]);
    }
    expect(await getInventoryItem(OBSOLETE_ITEM)).toEqual(before);
  });

  it("biến thể còn dùng: lưu logistics bình thường, version + 1", async () => {
    const before = await getInventoryItem(ACTIVE_ITEM);
    const saved = await saveItemLogistics({
      id: ACTIVE_ITEM,
      version: before.version,
      values: { ...logisticsToForm(before.logistics), barcode: "8939999999909", rotatable: false },
    });
    expect(saved.version).toBe(before.version + 1);
    expect(saved.logistics).toMatchObject({ barcode: "8939999999909", rotatable: false });
  });
});

describe("form logistics gặp VARIANT_OBSOLETE", () => {
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

  const logisticsPuts = (put: ReturnType<typeof signIn>["put"]) =>
    put.mock.calls.filter(([url]) => String(url).endsWith("/logistics"));

  async function editBarcode(value: string, user = userEvent.setup()) {
    const barcode = screen.getByLabelText(L.field.barcode);
    await user.clear(barcode);
    await user.type(barcode, value);
    await user.click(screen.getByRole("button", { name: L.saveLogistics }));
  }

  it("SKU đã ngừng: lưu → báo VARIANT_OBSOLETE, giữ bản nháp + form mở, không báo thành công, không gửi lại", async () => {
    const { put, success } = signIn();
    renderInventoryScreen(<InventoryItemDetail id={OBSOLETE_ITEM} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: L.editLogistics }, WAIT));
    await editBarcode("8939999999909", user);

    expect(await screen.findByText(E.VARIANT_OBSOLETE, {}, WAIT)).toBeInTheDocument();
    expect(screen.queryByText(E.OPTIMISTIC_LOCK)).toBeNull();
    expect(screen.getByLabelText(L.field.barcode)).toHaveValue("8939999999909");
    expect(screen.getByRole("button", { name: L.saveLogistics })).toBeInTheDocument();
    expect(logisticsPuts(put)).toHaveLength(1);
    expect(success).not.toHaveBeenCalled();
  });

  it("biến thể bị ngừng TRONG LÚC đang sửa → BE từ chối khi lưu; không nhầm với OPTIMISTIC_LOCK", async () => {
    const { get, put, success } = signIn();
    renderInventoryScreen(<InventoryItemDetail id={ACTIVE_ITEM} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: L.editLogistics }, WAIT));
    // người khác ngừng biến thể (route mock thật) — version hồ sơ không đổi
    await api.post("/products/PRD-001/variants/SKU-001-BLK-M/obsoletion");
    const itemGets = () =>
      get.mock.calls.filter(([url]) => url === `/inventory/items/${ACTIVE_ITEM}`).length;
    const getsBefore = itemGets();
    await editBarcode("8939999999908", user);

    expect(await screen.findByText(E.VARIANT_OBSOLETE, {}, WAIT)).toBeInTheDocument();
    expect(screen.queryByText(E.OPTIMISTIC_LOCK)).toBeNull();
    expect(screen.getByLabelText(L.field.barcode)).toHaveValue("8939999999908");
    expect(logisticsPuts(put)).toHaveLength(1);
    expect(success).not.toHaveBeenCalled();
    // không phải lỗi "dữ liệu cũ": không tự tải lại hồ sơ để nạp đè bản nháp
    await waitFor(() => expect(itemGets()).toBe(getsBefore));
  });
});
