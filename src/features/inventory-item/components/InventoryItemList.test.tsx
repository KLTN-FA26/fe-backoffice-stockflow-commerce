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

async function openFilter() {
  await userEvent.click(await screen.findByRole("button", { name: "Lọc trạng thái" }));
}
const pick = async (name: string) => userEvent.click(await screen.findByRole("option", { name }));

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

  it("readOnly → thấy SKU; dòng chưa cấu hình được đánh dấu", async () => {
    mockApiGet(ITEM_PERMISSION_SETS.readOnly, {
      [ITEMS]: () =>
        itemsPage([
          summaryItem(),
          summaryItem({ id: "2", sku: "MUG-WHITE", policyConfigured: false }),
        ]),
    });
    renderInventoryScreen(<InventoryItemList />);

    const link = await screen.findByRole("link", { name: "TSHIRT-RED-M" });
    expect(link).toHaveAttribute("href", expect.stringContaining("/admin/inventory-items/"));
    const flagged = (await screen.findByText("MUG-WHITE")).closest("tr");
    expect(flagged).toHaveAttribute("data-flagged", "true");
    expect(link.closest("tr")).not.toHaveAttribute("data-flagged");
  });

  it("chọn lọc 'Chưa cấu hình' → GET kèm policyConfigured=false và page=0", async () => {
    const get = mockApiGet(ITEM_PERMISSION_SETS.readOnly, { [ITEMS]: () => itemsPage() });
    renderInventoryScreen(<InventoryItemList />, "?page=3");
    await screen.findByText("TSHIRT-RED-M");

    await openFilter();
    await pick(L.policy.unconfigured);

    await vi.waitFor(() =>
      expect(lastParams(get)).toMatchObject({ policyConfigured: false, page: 0 }),
    );
  });

  it("chọn 'Lạnh' rồi 'Dễ vỡ' → chỉ còn storageClass=FRAGILE", async () => {
    const get = mockApiGet(ITEM_PERMISSION_SETS.readOnly, { [ITEMS]: () => itemsPage() });
    renderInventoryScreen(<InventoryItemList />);
    await screen.findByText("TSHIRT-RED-M");

    await openFilter();
    await pick(L.storageClass.COLD);
    await vi.waitFor(() => expect(lastParams(get)).toMatchObject({ storageClass: "COLD" }));
    await pick(L.storageClass.FRAGILE);
    await vi.waitFor(() => expect(lastParams(get)).toMatchObject({ storageClass: "FRAGILE" }));
    // Chỉ còn một giá trị trong nhóm: thanh Cấu hình hiện đúng "Dễ vỡ", không ghép với "Lạnh"
    const summary = `${L.field.storageClass}: ${L.storageClass.FRAGILE}`;
    await vi.waitFor(() => expect(screen.getByText(summary)).toBeInTheDocument());
    expect(
      screen.queryByText(new RegExp(`${L.field.storageClass}:.*${L.storageClass.COLD}`)),
    ).toBeNull();
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
