import { screen } from "@testing-library/react";
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

  it("readOnly → thấy SKU, đơn vị tính và mã vạch; không còn bộ lọc chính sách / lớp lưu trữ", async () => {
    mockApiGet(ITEM_PERMISSION_SETS.readOnly, {
      [ITEMS]: () => itemsPage([summaryItem(), summaryItem({ id: "2", sku: "MUG-WHITE" })]),
    });
    renderInventoryScreen(<InventoryItemList />);

    const link = await screen.findByRole("link", { name: "TSHIRT-RED-M" });
    expect(link).toHaveAttribute("href", expect.stringContaining("/admin/inventory-items/"));
    expect(await screen.findByText("MUG-WHITE")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lọc trạng thái" })).toBeNull();
  });

  it("tìm → GET kèm q đã trim và page=0", async () => {
    const get = mockApiGet(ITEM_PERMISSION_SETS.readOnly, { [ITEMS]: () => itemsPage() });
    renderInventoryScreen(<InventoryItemList />, "?page=3&q=%20MUG%20");
    await vi.waitFor(() => expect(lastParams(get)).toMatchObject({ q: "MUG" }));
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
