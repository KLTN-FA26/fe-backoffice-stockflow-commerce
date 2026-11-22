import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PUTAWAY_DETAIL_LABELS, SLOTTING_LABELS } from "@/constants";
import { PERMISSION_UI } from "@/constants/permissions";
import { mockApi, renderScreen } from "@/test/api-screen";

import { SlottingView } from "../components/slotting/SlottingView";
import { task } from "./fixtures";

import type { TestRole } from "@/test/api-screen";
import type { PutawayTask } from "../types";

const L = SLOTTING_LABELS;
const page = <T,>(items: T[]) => ({
  items,
  page: 0,
  size: 200,
  totalElements: items.length,
  totalPages: 1,
  hasNext: false,
  hasPrevious: false,
});
const WAREHOUSES = [{ id: "wh-1", prefix: "HCM", name: "Kho Hồ Chí Minh", status: "ACTIVE" }];
const A = task({ id: "t-a", lpn: "LPN-A" });
const B = task({ id: "t-b", lpn: "LPN-B", lotNumber: "LOT-B" });
const detail = (t: PutawayTask): PutawayTask => ({
  ...t,
  suggestions: [
    { locationCode: `BIN-${t.lpn}`, reason: "EMPTY", freeVolumeM3: 8.4, freeWeightKg: 250 },
  ],
});

function setup({
  role = "WAREHOUSE_STAFF" as TestRole,
  rows = [B, A],
  search = "",
  prefix = "HCM",
} = {}) {
  const spies = mockApi(role, {
    get: {
      "/warehouses": () => page(WAREHOUSES),
      "/putaway-tasks": () => page(rows),
      "/putaway-tasks/t-a": () => detail(A),
      "/putaway-tasks/t-b": () => detail(B),
    },
  });
  renderScreen(<SlottingView prefix={prefix} />, role, search);
  return spies;
}

afterEach(() => vi.restoreAllMocks());

describe("SlottingView — Gợi ý vị trí theo kho (docs 06 §4.4)", () => {
  it("prefix → id kho; thùng đầu (theo LPN) được chọn sẵn, bin gợi ý + lối sang màn cất", async () => {
    const { get } = setup();
    expect(await screen.findByText(L.suggestionsFor("LPN-A"))).toBeInTheDocument();
    expect(get.mock.calls.find(([url]) => url === "/putaway-tasks")?.[1]).toMatchObject({
      params: { warehouseId: "wh-1" },
    });
    expect(screen.getByText("BIN-LPN-A")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: L.putAway })).toHaveAttribute(
      "href",
      "/admin/putaway/t-a",
    );
    // Trang chỉ đọc: không có nút chọn bin như màn cất
    expect(
      screen.queryByRole("button", { name: PUTAWAY_DETAIL_LABELS.chooseBin("BIN-LPN-A") }),
    ).not.toBeInTheDocument();
  });

  it("chọn thùng khác → tải gợi ý của thùng đó", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText(L.suggestionsFor("LPN-A"));
    await user.click(screen.getByRole("button", { name: /^LPN-B/ }));
    expect(await screen.findByText(L.suggestionsFor("LPN-B"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^LPN-B/ })).toHaveAttribute("aria-current", "true");
  });

  it("?task= không còn chờ cất → về thùng đầu tiên", async () => {
    setup({ search: "?task=gone" });
    expect(await screen.findByText(L.suggestionsFor("LPN-A"))).toBeInTheDocument();
  });

  it("kho không còn thùng → EmptyState, vẫn giải thích quy tắc", async () => {
    setup({ rows: [] });
    expect(await screen.findByText(L.noCartons.title)).toBeInTheDocument();
    expect(screen.getByText(L.rules.title)).toBeInTheDocument();
  });

  it("ô lọc thu hẹp danh sách thùng", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText(L.suggestionsFor("LPN-A"));
    await user.type(screen.getByRole("textbox", { name: L.search }), "lot-b");
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /^LPN-A/ })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /^LPN-B/ })).toBeInTheDocument();
  });

  it("prefix không có trong danh mục kho → báo không tìm thấy kho", async () => {
    setup({ prefix: "XYZ" });
    expect(await screen.findByText(L.warehouseUnknown)).toBeInTheDocument();
  });

  it("vai trò không có quyền cất hàng → báo không có quyền", async () => {
    setup({ role: "QC_STAFF" });
    expect(await screen.findByText(PERMISSION_UI.deniedTitle)).toBeInTheDocument();
  });
});
