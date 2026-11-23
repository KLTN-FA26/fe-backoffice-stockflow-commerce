import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PUTAWAY_LABELS, STORAGE_KEYS } from "@/constants";
import { PERMISSION_UI } from "@/constants/permissions";
import { WorkspaceWarehouseProvider } from "@/lib/workspace";
import { mockApi, renderScreen } from "@/test/api-screen";

import { PutawayList } from "../components/PutawayList";
import { task } from "./fixtures";

import type { TestRole } from "@/test/api-screen";
import type { PutawayTask } from "../types";

const L = PUTAWAY_LABELS;
const HCM = { id: "wh-1", prefix: "HCM", name: "Kho Hồ Chí Minh" };

const page = <T,>(items: T[]) => ({
  items,
  page: 0,
  size: 200,
  totalElements: items.length,
  totalPages: 1,
  hasNext: false,
  hasPrevious: false,
});

const ROWS = [
  task({ id: "t-3", lpn: "LPN-3", sku: "SKU-RED", lotNumber: "LOT-X" }),
  task({ id: "t-1", lpn: "LPN-1", sku: "SKU-BLUE", lotNumber: "LOT-Y" }),
  task({
    id: "t-2",
    lpn: "LPN-2",
    sku: "SKU-RED",
    lotNumber: "LOT-X",
    source: "QUARANTINE_RELEASE",
    goodsReceiptId: null,
  }),
];

function setup({
  role = "WAREHOUSE_STAFF" as TestRole,
  search = "",
  rows = ROWS,
}: { role?: TestRole; search?: string; rows?: PutawayTask[] } = {}) {
  const spies = mockApi(role, { get: { "/putaway-tasks": () => page(rows) } });
  renderScreen(
    <WorkspaceWarehouseProvider value={HCM}>
      <PutawayList />
    </WorkspaceWarehouseProvider>,
    role,
    search,
  );
  return spies;
}

type Spies = ReturnType<typeof setup>;
const taskCalls = ({ get }: Spies) => get.mock.calls.filter(([url]) => url === "/putaway-tasks");
const lpnCells = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[0]?.textContent);

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("PutawayList (docs 05 §4.2)", () => {
  it("kho của tab → gửi warehouseId, một trang 200 dòng; dòng sắp theo LPN", async () => {
    const spies = setup();
    expect(await screen.findByText("LPN-1")).toBeInTheDocument();
    expect(taskCalls(spies).at(-1)?.[1]).toMatchObject({
      params: { page: 0, size: 200, warehouseId: "wh-1" },
    });
    expect(lpnCells()).toEqual(["LPN-1", "LPN-2", "LPN-3"]);
  });

  it("không còn ô chọn kho trong màn (kho chọn một lần ở tab)", async () => {
    setup();
    await screen.findByText("LPN-1");
    expect(screen.queryByRole("combobox", { name: "Kho" })).not.toBeInTheDocument();
    expect(screen.queryByText("Kho")).not.toBeInTheDocument();
  });

  it("link thùng và nút chuyến cất hàng ở lại trong kho của tab", async () => {
    setup();
    await screen.findByText("LPN-1");
    expect(screen.getByRole("link", { name: "LPN-1" })).toHaveAttribute(
      "href",
      "/admin/warehouse-map/HCM/putaway/t-1",
    );
    expect(screen.getByRole("link", { name: /Chuyến cất hàng|Mở chuyến/ })).toHaveAttribute(
      "href",
      "/admin/warehouse-map/HCM/putaway/trip",
    );
  });

  it("?receipt= (từ phiếu nhận) gửi receiptId thay kho", async () => {
    const spies = setup({ search: "?receipt=gr-9" });
    await screen.findByText("LPN-1");
    const config = taskCalls(spies).at(-1)?.[1];
    expect(config).toMatchObject({ params: { page: 0, size: 200, receiptId: "gr-9" } });
    expect(config).not.toHaveProperty("params.warehouseId");
  });

  it("kho không còn thùng chờ cất → EmptyState riêng (khác lọc không ra)", async () => {
    setup({ rows: [] });
    expect(await screen.findByText(L.empty.none.title)).toBeInTheDocument();
  });

  it('?receipt= mà phiếu không còn nhiệm vụ → "lọc không ra" kèm Bỏ bộ lọc (không phải kho trống)', async () => {
    setup({ search: "?receipt=gr-9", rows: [] });
    expect(await screen.findByText(L.empty.noMatch.title)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: L.empty.noMatch.clear })).toBeInTheDocument();
    expect(screen.queryByText(L.empty.none.title)).not.toBeInTheDocument();
  });

  it("search chính lọc trên dòng đã tải, không gọi lại API; không ra → Bỏ bộ lọc", async () => {
    const user = userEvent.setup();
    const spies = setup();
    await screen.findByText("LPN-1");
    const calls = taskCalls(spies).length;
    await user.type(screen.getByRole("textbox", { name: L.searchPlaceholder }), "sku-red");
    await waitFor(() => expect(lpnCells()).toEqual(["LPN-2", "LPN-3"]));
    await user.type(screen.getByRole("textbox", { name: L.searchPlaceholder }), "-x");
    expect(await screen.findByText(L.empty.noMatch.title)).toBeInTheDocument();
    expect(taskCalls(spies)).toHaveLength(calls);
    await user.click(screen.getByRole("button", { name: L.empty.noMatch.clear }));
    await waitFor(() => expect(lpnCells()).toHaveLength(3));
  });

  it("lọc trong cột từ URL hiện chip Search trong cột, X trả lại dòng", async () => {
    const user = userEvent.setup();
    setup({ search: "?sku=blue" });
    await screen.findByText("LPN-1");
    expect(lpnCells()).toEqual(["LPN-1"]);
    expect(screen.getByText(/SKU “blue”/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: `Xoá ${L.summaryColumnSearch}` }));
    await waitFor(() => expect(lpnCells()).toHaveLength(3));
  });

  it("nguồn phiếu nhập là link sang phiếu; giải phóng cách ly là chữ", async () => {
    setup();
    await screen.findByText("LPN-1");
    expect(screen.getAllByRole("link", { name: L.source.RECEIPT })[0]).toHaveAttribute(
      "href",
      "/admin/receipts/gr-1",
    );
    expect(screen.getByText(L.source.QUARANTINE_RELEASE)).toBeInTheDocument();
  });

  it("config đã lưu có cột lạ / thiếu cột khoá → bỏ cột lạ, giữ LPN", async () => {
    window.localStorage.setItem(
      STORAGE_KEYS.adminPutawayConfig,
      JSON.stringify({ visibleColumns: ["sku", "ghost"] }),
    );
    setup();
    await screen.findByText("LPN-1");
    expect(screen.getByRole("columnheader", { name: /LPN/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /SKU/ })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: /^Lô/ })).not.toBeInTheDocument();
    expect(screen.getByText(/2\/7/)).toBeInTheDocument();
  });

  it("vai trò không có quyền cất hàng → báo không có quyền, không gọi API", async () => {
    const spies = setup({ role: "QC_STAFF" });
    expect(await screen.findByText(PERMISSION_UI.deniedTitle)).toBeInTheDocument();
    expect(taskCalls(spies)).toHaveLength(0);
  });
});
