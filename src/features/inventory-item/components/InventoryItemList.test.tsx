import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UI_LABELS } from "@/constants";
import { PERMISSION_UI } from "@/constants/permissions";

import {
  ITEM_PERMISSION_SETS,
  itemsPage,
  mockApiGet,
  renderInventoryScreen,
  summaryItem,
} from "../__fixtures__/render";
import { InventoryItemList } from "./InventoryItemList";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

const L = UI_LABELS.inventoryItem;
const ITEMS = "/inventory/items";

type Get = ReturnType<typeof mockApiGet>;
const itemCalls = (get: Get) => get.mock.calls.filter(([url]) => url === ITEMS);
const lastParams = (get: Get) => {
  const calls = itemCalls(get);
  return calls[calls.length - 1]?.[1]?.params as Record<string, unknown> | undefined;
};

describe("InventoryItemList", () => {
  it("không có quyền VIEW_PAGE → màn từ chối của PermissionBoundary, không gọi /inventory/items", async () => {
    const get = mockApiGet(ITEM_PERMISSION_SETS.none, { [ITEMS]: () => itemsPage() });
    renderInventoryScreen(<InventoryItemList />);

    expect(await screen.findByText(PERMISSION_UI.deniedTitle)).toBeInTheDocument();
    expect(itemCalls(get)).toHaveLength(0);
  });

  it("chỉ VIEW_PAGE → báo không có quyền xem dữ liệu, không gọi API", async () => {
    const get = mockApiGet(ITEM_PERMISSION_SETS.viewOnly, { [ITEMS]: () => itemsPage() });
    renderInventoryScreen(<InventoryItemList />);

    expect(await screen.findByText(UI_LABELS.loadError.noReadTitle)).toBeInTheDocument();
    expect(itemCalls(get)).toHaveLength(0);
  });

  it("readOnly → thấy SKU (link chi tiết), đơn vị tính, mã vạch; không còn cột / lọc chính sách", async () => {
    mockApiGet(ITEM_PERMISSION_SETS.readOnly, {
      [ITEMS]: () =>
        itemsPage([summaryItem(), summaryItem({ id: "2", sku: "MUG-WHITE", barcode: undefined })]),
    });
    renderInventoryScreen(<InventoryItemList />);

    const link = await screen.findByRole("link", { name: "TSHIRT-RED-M" });
    expect(link).toHaveAttribute("href", expect.stringContaining("/admin/inventory-items/"));
    expect(screen.getByText("MUG-WHITE")).toBeInTheDocument();
    expect(screen.getByText("8930000000011")).toBeInTheDocument();
    for (const header of [L.field.sku, L.field.unitOfMeasure, L.field.barcode]) {
      expect(screen.getAllByText(header).length).toBeGreaterThan(0);
    }
    expect(screen.queryByRole("button", { name: "Lọc trạng thái" })).toBeNull();
  });

  it("tìm theo SKU / mã vạch → GET chỉ kèm q và page=0 (BE không còn lọc lưu kho / chính sách)", async () => {
    const get = mockApiGet(ITEM_PERMISSION_SETS.readOnly, { [ITEMS]: () => itemsPage() });
    renderInventoryScreen(<InventoryItemList />, "?page=3");
    await screen.findByText("TSHIRT-RED-M");

    await userEvent.type(screen.getByPlaceholderText(L.searchPlaceholder), "TSHIRT");

    await vi.waitFor(() => expect(lastParams(get)).toMatchObject({ q: "TSHIRT", page: 0 }));
    expect(lastParams(get)).not.toHaveProperty("storageClass");
    expect(lastParams(get)).not.toHaveProperty("policyConfigured");
  });

  it("rỗng không lọc → noItems; rỗng có lọc → noResults + Bỏ bộ lọc", async () => {
    mockApiGet(ITEM_PERMISSION_SETS.readOnly, { [ITEMS]: () => itemsPage([]) });
    const { unmount } = renderInventoryScreen(<InventoryItemList />);
    expect(await screen.findByText(L.empty.noItems)).toBeInTheDocument();
    unmount();

    renderInventoryScreen(<InventoryItemList />, "?q=khongco");
    expect(await screen.findByText(L.empty.noResults)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: L.empty.clearFilters })).toBeInTheDocument();
  });

  it("trang vượt quá dữ liệu (?page=5, total > 0, items rỗng) → invalidPage + nút về trang 1", async () => {
    mockApiGet(ITEM_PERMISSION_SETS.readOnly, { [ITEMS]: () => itemsPage([], 7) });
    renderInventoryScreen(<InventoryItemList />, "?page=5");

    expect(await screen.findByText(L.invalidPage)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: L.empty.firstPage })).toBeInTheDocument();
  });
});
