import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { SUPPLIER_ITEM_UI_LABELS } from "@/constants";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { PERMISSION_SETS, mockApiGet, renderSupplierScreen } from "../../../__fixtures__/render";
import { supplier } from "../../../__fixtures__/supplier";
import { apiItemPage, apiSupplierItem } from "../../../__fixtures__/supplier-item";
import { SupplierItemsTab } from "./SupplierItemsTab";

import type { PermissionCode } from "@/lib/auth";

const ITEMS_PATH = `/suppliers/${supplier.supplierId}/items`;
const INVENTORY_PATH = "/inventory/items";
// UI dài (mở dialog, gõ, debounce 300ms, điền form) — timeout riêng, không đổi cấu hình repo
const UI_TIMEOUT = 20_000;

/** Hình `InventoryItemSummary` BE; TEE-WHT-M đã có trong danh mục NCC (`apiSupplierItem`). */
const INVENTORY = [
  { sku: "SOFA-BLU-2S", barcode: "8930000000021" },
  { sku: "SOFA-GRY-3S" },
  { sku: apiSupplierItem.sku },
  { sku: "TEE-NEW-1" },
].map((row, i) => ({
  id: `0b6f6a8e-0000-4000-8000-00000000000${i}`,
  unitOfMeasure: "EACH",
  storageClass: "NORMAL",
  trackingMode: "NONE",
  policyConfigured: false,
  ...row,
}));

function inventoryPage(params: URLSearchParams | undefined) {
  const q = params?.get("q")?.toLowerCase() ?? "";
  const items = INVENTORY.filter((i) => !q || i.sku.toLowerCase().includes(q));
  return {
    items,
    page: 0,
    size: Number(params?.get("size") ?? 20),
    totalElements: items.length,
    totalPages: items.length ? 1 : 0,
    hasNext: false,
    hasPrevious: false,
  };
}

/** Chỉ cài mock GET (chưa render) — để test chèn thêm hành vi trước khi render. */
function renderTabSpy() {
  return mockApiGet(PERMISSION_SETS.procurementStaff, {
    [ITEMS_PATH]: () => apiItemPage(),
    [INVENTORY_PATH]: inventoryPage,
  });
}

function renderTab(permissions: readonly PermissionCode[]) {
  const get = mockApiGet(permissions, {
    [ITEMS_PATH]: () => apiItemPage(),
    [INVENTORY_PATH]: inventoryPage,
  });
  renderSupplierScreen(<SupplierItemsTab supplier={supplier} />);
  return get;
}

async function openAddDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Thêm SKU" }));
  return screen.findByRole("dialog");
}

beforeAll(() => {
  // jsdom không có ResizeObserver / scrollIntoView mà `cmdk` (combobox) dùng
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => {};
});

afterEach(() => vi.restoreAllMocks());

describe("Thêm SKU — chọn từ hồ sơ hàng tồn (GET /inventory/items)", () => {
  it(
    "gõ 'SOFA' → chỉ hiện SKU khớp, chọn → POST có sku đó",
    async () => {
      const user = userEvent.setup();
      const post = vi.spyOn(api, "post").mockResolvedValue({ data: apiSupplierItem });
      const get = renderTab(PERMISSION_SETS.procurementStaff);
      const dialog = await openAddDialog(user);

      await user.click(within(dialog).getByRole("combobox", { name: /^SKU/ }));
      await user.type(
        await screen.findByPlaceholderText(SUPPLIER_ITEM_UI_LABELS.skuPicker.search),
        "SOFA",
      );
      await waitFor(() =>
        expect(screen.queryByRole("option", { name: /TEE-NEW-1/ })).not.toBeInTheDocument(),
      );
      expect(screen.getByRole("option", { name: /SOFA-BLU-2S/ })).toBeInTheDocument();
      expect(
        get.mock.calls.some(
          ([url, config]) =>
            url === INVENTORY_PATH &&
            config?.params instanceof URLSearchParams &&
            config.params.get("q") === "SOFA",
        ),
      ).toBe(true);

      await user.click(screen.getByRole("option", { name: /SOFA-GRY-3S/ }));
      expect(within(dialog).getByRole("combobox", { name: /^SKU/ })).toHaveValue("SOFA-GRY-3S");
      await user.type(within(dialog).getByRole("textbox", { name: /^Giá/ }), "1000");
      await user.type(within(dialog).getByRole("textbox", { name: /Quy cách đóng gói/ }), "5");
      await user.type(within(dialog).getByRole("textbox", { name: /MOQ/ }), "10");
      const save = within(dialog).getByRole("button", { name: "Lưu" });
      await waitFor(() => expect(save).toBeEnabled());
      await user.click(save);

      await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
      expect(post.mock.calls[0]?.[0]).toBe(ITEMS_PATH);
      expect(post.mock.calls[0]?.[1]).toMatchObject({ sku: "SOFA-GRY-3S" });
    },
    UI_TIMEOUT,
  );

  it(
    "danh mục NCC > 200 dòng → báo SKU đã có có thể vẫn hiện (BE báo trùng khi lưu)",
    async () => {
      const user = userEvent.setup();
      mockApiGet(PERMISSION_SETS.procurementStaff, {
        [ITEMS_PATH]: () => ({
          ...apiItemPage(),
          totalElements: 201,
          totalPages: 2,
          hasNext: true,
        }),
        [INVENTORY_PATH]: inventoryPage,
      });
      renderSupplierScreen(<SupplierItemsTab supplier={supplier} />);
      const dialog = await openAddDialog(user);

      await user.click(within(dialog).getByRole("combobox", { name: /^SKU/ }));
      expect(
        await screen.findByText(SUPPLIER_ITEM_UI_LABELS.skuPicker.truncatedNotice),
      ).toBeInTheDocument();
    },
    UI_TIMEOUT,
  );

  it(
    "trang đầu toàn SKU đã có trong danh mục nhưng BE còn trang sau → nhắc gõ thêm, không báo 'không có SKU'",
    async () => {
      const user = userEvent.setup();
      mockApiGet(PERMISSION_SETS.procurementStaff, {
        [ITEMS_PATH]: () => apiItemPage(),
        [INVENTORY_PATH]: () => ({
          ...inventoryPage(new URLSearchParams({ q: apiSupplierItem.sku })),
          totalElements: 30,
          totalPages: 2,
          hasNext: true,
        }),
      });
      renderSupplierScreen(<SupplierItemsTab supplier={supplier} />);
      const dialog = await openAddDialog(user);

      await user.click(within(dialog).getByRole("combobox", { name: /^SKU/ }));
      expect(
        await screen.findByText(SUPPLIER_ITEM_UI_LABELS.skuPicker.emptyButMore),
      ).toBeInTheDocument();
      expect(screen.queryByText(SUPPLIER_ITEM_UI_LABELS.skuPicker.empty)).not.toBeInTheDocument();
    },
    UI_TIMEOUT,
  );

  it(
    "BE còn trang sau và có kết quả → hiện dòng nhắc gõ thêm dưới danh sách",
    async () => {
      const user = userEvent.setup();
      mockApiGet(PERMISSION_SETS.procurementStaff, {
        [ITEMS_PATH]: () => apiItemPage(),
        [INVENTORY_PATH]: (params: URLSearchParams | undefined) => ({
          ...inventoryPage(params),
          hasNext: true,
        }),
      });
      renderSupplierScreen(<SupplierItemsTab supplier={supplier} />);
      const dialog = await openAddDialog(user);

      await user.click(within(dialog).getByRole("combobox", { name: /^SKU/ }));
      expect(await screen.findByRole("option", { name: /TEE-NEW-1/ })).toBeInTheDocument();
      expect(screen.getByText(SUPPLIER_ITEM_UI_LABELS.skuPicker.moreResults)).toBeInTheDocument();
    },
    UI_TIMEOUT,
  );

  it(
    "danh mục NCC chưa tải xong → chưa hiện gợi ý (tránh chọn SKU đã có rồi bị 409)",
    async () => {
      const user = userEvent.setup();
      const get = renderTabSpy();
      const base = get.getMockImplementation();
      // Danh mục đủ 200 dòng cho ô chọn (khác trang của bảng) — treo để giữ trạng thái chờ
      get.mockImplementation((url, config) => {
        const params = config?.params instanceof URLSearchParams ? config.params : undefined;
        if (url === ITEMS_PATH && params?.get("size") === "200") return new Promise(() => {});
        if (!base) throw new Error("thiếu mock GET");
        return base(url, config);
      });
      renderSupplierScreen(<SupplierItemsTab supplier={supplier} />);
      const dialog = await openAddDialog(user);

      await user.click(within(dialog).getByRole("combobox", { name: /^SKU/ }));
      expect(
        await screen.findByText(SUPPLIER_ITEM_UI_LABELS.skuPicker.loading),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("option", { name: new RegExp(apiSupplierItem.sku) }),
      ).not.toBeInTheDocument();
    },
    UI_TIMEOUT,
  );

  it(
    "danh mục NCC cho ô chọn tải lỗi → báo SKU đã có có thể vẫn hiện",
    async () => {
      const user = userEvent.setup();
      const get = renderTabSpy();
      const base = get.getMockImplementation();
      get.mockImplementation((url, config) => {
        const params = config?.params instanceof URLSearchParams ? config.params : undefined;
        if (url === ITEMS_PATH && params?.get("size") === "200") {
          return Promise.reject(new ApiError(503, "SERVICE_UNAVAILABLE", "down"));
        }
        if (!base) throw new Error("thiếu mock GET");
        return base(url, config);
      });
      renderSupplierScreen(<SupplierItemsTab supplier={supplier} />);
      const dialog = await openAddDialog(user);

      await user.click(within(dialog).getByRole("combobox", { name: /^SKU/ }));
      expect(
        await screen.findByText(SUPPLIER_ITEM_UI_LABELS.skuPicker.catalogFailedNotice),
      ).toBeInTheDocument();
    },
    UI_TIMEOUT,
  );

  it(
    "SKU NCC đã có trong danh mục không hiện trong danh sách",
    async () => {
      const user = userEvent.setup();
      renderTab(PERMISSION_SETS.procurementStaff);
      const dialog = await openAddDialog(user);

      await user.click(within(dialog).getByRole("combobox", { name: /^SKU/ }));
      expect(await screen.findByRole("option", { name: /TEE-NEW-1/ })).toBeInTheDocument();
      expect(
        screen.queryByRole("option", { name: new RegExp(apiSupplierItem.sku) }),
      ).not.toBeInTheDocument();
    },
    UI_TIMEOUT,
  );

  it(
    "thiếu inventory-inventory-items:READ → ô gõ tay + dòng giải thích, không gọi /inventory/items",
    async () => {
      const user = userEvent.setup();
      const get = renderTab(PERMISSION_SETS.procurementNoInventory);
      const dialog = await openAddDialog(user);

      expect(within(dialog).getByRole("textbox", { name: /^SKU/ })).not.toHaveAttribute("readonly");
      expect(within(dialog).queryByRole("combobox", { name: /^SKU/ })).not.toBeInTheDocument();
      expect(
        within(dialog).getByText(SUPPLIER_ITEM_UI_LABELS.skuPicker.manualNotice),
      ).toBeInTheDocument();
      expect(get.mock.calls.some(([url]) => url === INVENTORY_PATH)).toBe(false);
    },
    UI_TIMEOUT,
  );

  it(
    "sửa dòng → SKU vẫn khoá, không có combobox",
    async () => {
      const user = userEvent.setup();
      const get = renderTab(PERMISSION_SETS.procurementStaff);

      await user.click(await screen.findByRole("button", { name: `Sửa ${apiSupplierItem.sku}` }));
      const dialog = await screen.findByRole("dialog");

      const sku = within(dialog).getByRole("textbox", { name: /^SKU/ });
      expect(sku).toHaveAttribute("readonly");
      expect(sku).toHaveValue(apiSupplierItem.sku);
      expect(within(dialog).queryByRole("combobox", { name: /^SKU/ })).not.toBeInTheDocument();
      expect(get.mock.calls.some(([url]) => url === INVENTORY_PATH)).toBe(false);
    },
    UI_TIMEOUT,
  );
});
