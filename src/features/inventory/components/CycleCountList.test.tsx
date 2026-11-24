import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CYCLE_COUNT_API,
  CYCLE_COUNT_COLUMNS,
  CYCLE_COUNT_CREATE_LABELS as C,
  CYCLE_COUNT_LABELS,
  CYCLE_COUNT_STORAGE_KEYS,
} from "@/constants/cycle-count";
import { INVENTORY_LABELS } from "@/constants/inventory";
import { CYCLE_COUNT_PERMISSIONS } from "@/constants/permissions";

import {
  cycleCountFixture,
  cycleCountSummaryFixture,
  INVENTORY_TAB_WAREHOUSE,
  inventoryEndpoint,
  inventoryPermissions,
  renderInventory,
  setInventoryTestActor,
} from "../test-support";
import { CycleCountList } from "./CycleCountList";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));

const server = setupServer();
const endpoint = inventoryEndpoint(CYCLE_COUNT_API.list);
const { viewPage, read } = CYCLE_COUNT_PERMISSIONS;
// ListToolbar / ListConfigSummary (shared, unlabelled constants)
const RESET_ALL = "Đặt lại";
const STATUS_TOOL = "Lọc trạng thái";
const COLUMNS_TOOL = "Ẩn hiện cột";
const page = (items: unknown[]) => ({
  items,
  page: 0,
  size: 15,
  totalElements: items.length,
  totalPages: items.length ? 1 : 0,
  hasNext: false,
  hasPrevious: false,
});
beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => undefined;
  Element.prototype.scrollIntoView ??= () => undefined;
});
beforeEach(() => {
  localStorage.clear();
  setInventoryTestActor("Warehouse Staff");
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
  localStorage.clear();
});
afterAll(() => {
  server.close();
});

describe("cycle count list (docs 20 §4.2, §5.2)", () => {
  it("lists the open sheets, including the one a short pick opened, and links each detail", async () => {
    const shortPick = cycleCountSummaryFixture({
      countNumber: "CC-SP-1",
      triggerType: "SHORT_PICK",
      status: "PLANNED",
      lineCount: 1,
      countedCount: 0,
    });
    const manual = cycleCountSummaryFixture({
      countNumber: "CC-MAN-1",
      triggerType: "MANUAL",
      status: "IN_PROGRESS",
      lineCount: 4,
      countedCount: 3,
    });
    server.use(
      inventoryPermissions([viewPage, read]),
      http.get(endpoint, () =>
        HttpResponse.json({ success: true, data: page([shortPick, manual]) }),
      ),
    );
    renderInventory(<CycleCountList />);
    const link = await screen.findByRole("link", { name: "CC-SP-1" });
    expect(link).toHaveAttribute("href", `/admin/warehouse-map/HCM/cycle-counts/${shortPick.id}`);
    const shortRow = link.closest("tr");
    const manualRow = screen.getByRole("link", { name: "CC-MAN-1" }).closest("tr");
    if (!shortRow || !manualRow) throw new Error("rows not rendered");
    expect(within(shortRow).getByText(CYCLE_COUNT_LABELS.blindBadge)).toBeInTheDocument();
    expect(within(shortRow).getByText("Báo thiếu khi lấy hàng")).toBeInTheDocument();
    expect(within(shortRow).getByText("Đã lập phiếu")).toBeInTheDocument();
    expect(within(shortRow).getByRole("cell", { name: "0/1" })).toBeInTheDocument();
    expect(within(manualRow).getByText("Đang đếm")).toBeInTheDocument();
    expect(within(manualRow).getByRole("cell", { name: "3/4" })).toBeInTheDocument();
  });

  it("shows no variance count to a counter — the backend leaves it out and the screen does not guess", async () => {
    const hidden = cycleCountSummaryFixture({ countNumber: "CC-HIDDEN" });
    const known = cycleCountSummaryFixture({ countNumber: "CC-KNOWN", varianceCount: 2 });
    server.use(
      inventoryPermissions([viewPage, read]),
      http.get(endpoint, () => HttpResponse.json({ success: true, data: page([hidden, known]) })),
    );
    renderInventory(<CycleCountList />);
    const hiddenRow = (await screen.findByRole("link", { name: "CC-HIDDEN" })).closest("tr");
    const knownRow = screen.getByRole("link", { name: "CC-KNOWN" }).closest("tr");
    if (!hiddenRow || !knownRow) throw new Error("rows not rendered");
    expect(
      within(hiddenRow).getAllByRole("cell", { name: CYCLE_COUNT_LABELS.missing }).length,
    ).toBeGreaterThan(0);
    expect(within(knownRow).getByRole("cell", { name: "2" })).toBeInTheDocument();
  });

  it("keeps a sheet with a status or source the app does not know visible, verbatim", async () => {
    const odd = cycleCountSummaryFixture({
      countNumber: "CC-ODD",
      status: "ON_HOLD",
      triggerType: "FUTURE_SOURCE",
    });
    server.use(
      inventoryPermissions([viewPage, read]),
      http.get(endpoint, () => HttpResponse.json({ success: true, data: page([odd]) })),
    );
    renderInventory(<CycleCountList />);
    expect(await screen.findByRole("link", { name: "CC-ODD" })).toBeInTheDocument();
    expect(screen.getByText("FUTURE_SOURCE")).toBeInTheDocument();
    expect(screen.getByTitle(/ON_HOLD/)).toBeInTheDocument();
  });

  it("sends only the wire status of the filter and keeps it on the URL", async () => {
    const statuses = vi.fn();
    const warehouses = vi.fn();
    server.use(
      inventoryPermissions([viewPage, read]),
      http.get(endpoint, ({ request }) => {
        const query = new URL(request.url).searchParams;
        statuses(query.get("status"));
        warehouses(query.get("warehouseId"));
        return HttpResponse.json({ success: true, data: page([]) });
      }),
    );
    renderInventory(<CycleCountList />, "?status=IN_PROGRESS");
    await screen.findByText(INVENTORY_LABELS.noResults);
    expect(statuses).toHaveBeenLastCalledWith("IN_PROGRESS");
    // Chỉ phiếu của kho trong tab theo kho
    expect(warehouses).toHaveBeenLastCalledWith(INVENTORY_TAB_WAREHOUSE.id);
    // The status chip on the config bar; "Đặt lại" of the toolbar clears the filter like the empty state's way out.
    expect(screen.getByText(`${CYCLE_COUNT_LABELS.status}: Đang đếm`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: INVENTORY_LABELS.reset })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: RESET_ALL }));
    await screen.findByText(CYCLE_COUNT_LABELS.noCounts);
    expect(statuses).toHaveBeenLastCalledWith(null);
  });

  it("the status filter is the toolbar facet: one wire status on the BE param, a chip, again to clear", async () => {
    const statuses = vi.fn();
    server.use(
      inventoryPermissions([viewPage, read]),
      http.get(endpoint, ({ request }) => {
        statuses(new URL(request.url).searchParams.get("status"));
        return HttpResponse.json({ success: true, data: page([]) });
      }),
    );
    const user = userEvent.setup();
    renderInventory(<CycleCountList />);
    await screen.findByText(CYCLE_COUNT_LABELS.noCounts);
    expect(statuses).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole("button", { name: RESET_ALL })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: STATUS_TOOL }));
    const options = within(await screen.findByRole("listbox")).getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "Đã lập phiếu",
      "Đang đếm",
      expect.any(String),
      expect.any(String),
    ]);
    await user.click(screen.getByRole("option", { name: "Đang đếm" }));
    await waitFor(() => expect(statuses).toHaveBeenLastCalledWith("IN_PROGRESS"));
    expect(await screen.findByText(INVENTORY_LABELS.noResults)).toBeInTheDocument();
    expect(screen.getByText(`${CYCLE_COUNT_LABELS.status}: Đang đếm`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: RESET_ALL })).toBeEnabled();
    // BE nhận một trạng thái: chọn lại cùng option là bỏ lọc
    await user.click(screen.getByRole("option", { name: "Đang đếm" }));
    await waitFor(() => expect(statuses).toHaveBeenLastCalledWith(null));
    expect(await screen.findByText(CYCLE_COUNT_LABELS.noCounts)).toBeInTheDocument();
  });

  it("hides a column from the toolbar, keeps the locked number column, and the chip brings it back", async () => {
    const fetched = vi.fn();
    server.use(
      inventoryPermissions([viewPage, read]),
      http.get(endpoint, () => {
        fetched();
        return HttpResponse.json({
          success: true,
          data: page([cycleCountSummaryFixture({ countNumber: "CC-COL-1" })]),
        });
      }),
    );
    const user = userEvent.setup();
    renderInventory(<CycleCountList />);
    await screen.findByRole("link", { name: "CC-COL-1" });
    expect(screen.getByText(`${CYCLE_COUNT_LABELS.summaryColumns}: 7/7`)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: COLUMNS_TOOL }));
    // Mã phiếu là link sang chi tiết — khoá, không tắt được
    expect(await screen.findByRole("option", { name: CYCLE_COUNT_LABELS.number })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.click(screen.getByRole("option", { name: CYCLE_COUNT_LABELS.trigger }));
    await waitFor(() =>
      expect(
        screen.queryByRole("columnheader", { name: CYCLE_COUNT_LABELS.trigger }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("columnheader", { name: CYCLE_COUNT_LABELS.number }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: `${CYCLE_COUNT_LABELS.open} CC-COL-1` }),
    ).toBeInTheDocument();
    expect(screen.getByText(`${CYCLE_COUNT_LABELS.summaryColumns}: 6/7`)).toBeInTheDocument();
    // Sở thích cá nhân → localStorage, không lên URL, không gọi lại API
    expect(
      JSON.parse(localStorage.getItem(CYCLE_COUNT_STORAGE_KEYS.columns) ?? "{}").visibleColumns,
    ).not.toContain(CYCLE_COUNT_COLUMNS.TRIGGER);
    expect(fetched).toHaveBeenCalledTimes(1);
    await user.keyboard("{Escape}");
    await user.click(
      screen.getByRole("button", { name: `Xoá ${CYCLE_COUNT_LABELS.summaryColumns}` }),
    );
    expect(
      await screen.findByRole("columnheader", { name: CYCLE_COUNT_LABELS.trigger }),
    ).toBeInTheDocument();
    expect(screen.getByText(`${CYCLE_COUNT_LABELS.summaryColumns}: 7/7`)).toBeInTheDocument();
  });

  it("a stored column config with a removed key drops it and keeps the locked number column", async () => {
    localStorage.setItem(
      CYCLE_COUNT_STORAGE_KEYS.columns,
      JSON.stringify({ visibleColumns: ["gone", CYCLE_COUNT_COLUMNS.TRIGGER] }),
    );
    server.use(
      inventoryPermissions([viewPage, read]),
      http.get(endpoint, () =>
        HttpResponse.json({
          success: true,
          data: page([cycleCountSummaryFixture({ countNumber: "CC-OLD-1" })]),
        }),
      ),
    );
    renderInventory(<CycleCountList />);
    await screen.findByRole("link", { name: "CC-OLD-1" });
    expect(
      await screen.findByText(`${CYCLE_COUNT_LABELS.summaryColumns}: 2/7`),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: CYCLE_COUNT_LABELS.number }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: CYCLE_COUNT_LABELS.trigger }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: CYCLE_COUNT_LABELS.status })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: CYCLE_COUNT_LABELS.plannedDate })).toBeNull();
  });

  it("tells 'nothing yet' apart from 'the filter matches nothing'", async () => {
    server.use(
      inventoryPermissions([viewPage, read]),
      http.get(endpoint, () => HttpResponse.json({ success: true, data: page([]) })),
    );
    renderInventory(<CycleCountList />);
    expect(await screen.findByText(CYCLE_COUNT_LABELS.noCounts)).toBeInTheDocument();
    cleanup();
    renderInventory(<CycleCountList />, "?status=CANCELLED");
    expect(await screen.findByText(INVENTORY_LABELS.noResults)).toBeInTheDocument();
  });

  it.each([
    ["VIEW_PAGE alone", [viewPage]],
    ["READ alone", [read]],
    ["nothing", []],
  ] as const)("is denied with %s — both codes are needed", async (_, permissions) => {
    const fetched = vi.fn();
    server.use(
      inventoryPermissions([...permissions]),
      http.get(endpoint, () => {
        fetched();
        return HttpResponse.json({ success: true, data: page([]) });
      }),
    );
    renderInventory(<CycleCountList />);
    expect(await screen.findByText(INVENTORY_LABELS.denied)).toBeInTheDocument();
    expect(fetched).not.toHaveBeenCalled();
  });

  it("says in Vietnamese when the list cannot load, and retries", async () => {
    let calls = 0;
    server.use(
      inventoryPermissions([viewPage, read]),
      http.get(endpoint, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json(
              { success: false, errorCode: "SERVER_ERROR", message: "Boom" },
              { status: 500 },
            )
          : HttpResponse.json({ success: true, data: page([]) });
      }),
    );
    renderInventory(<CycleCountList />);
    await userEvent.click(await screen.findByRole("button", { name: INVENTORY_LABELS.retry }));
    expect(await screen.findByText(CYCLE_COUNT_LABELS.noCounts)).toBeInTheDocument();
    expect(screen.queryByText("Boom")).not.toBeInTheDocument();
  });
});

describe("planning a count by hand (docs 20 §4.2 a, BR-12)", () => {
  const WAREHOUSE = INVENTORY_TAB_WAREHOUSE.id;
  const ZONE = "d0000001-0000-4000-8000-0000000000a2";
  const COUNTER = "d0000001-0000-4000-8000-0000000000a3";
  const ok = (data: unknown) => HttpResponse.json({ success: true, data });
  const manager = [
    CYCLE_COUNT_PERMISSIONS.viewPage,
    CYCLE_COUNT_PERMISSIONS.read,
    CYCLE_COUNT_PERMISSIONS.create,
  ];

  /** Kho cố định = kho của tab: không có ô chọn kho trong dialog (spec 2026-11-22 §5.8). */
  function expectNoWarehousePicker(dialog: HTMLElement) {
    expect(within(dialog).queryByRole("combobox", { name: new RegExp(C.warehouse) })).toBeNull();
  }

  function handlers(onPlan: (body: unknown) => Response) {
    server.use(
      inventoryPermissions(manager),
      http.get(endpoint, () => ok(page([]))),
      http.get(inventoryEndpoint(`/warehouses/${WAREHOUSE}/layout`), () =>
        ok({ zones: [{ id: ZONE, name: "Khu A" }], shelves: [], areas: [] }),
      ),
      http.get(inventoryEndpoint(CYCLE_COUNT_API.assignees), () =>
        ok([{ userId: COUNTER, displayName: "Nhân viên kho 1", roles: ["WAREHOUSE_STAFF"] }]),
      ),
      http.post(endpoint, async ({ request }) => onPlan(await request.json())),
    );
  }

  beforeEach(() => {
    navigation.push.mockClear();
  });

  it("a counter without inventory-cycle-counts:CREATE has no Lập phiếu button", async () => {
    server.use(
      inventoryPermissions([CYCLE_COUNT_PERMISSIONS.viewPage, CYCLE_COUNT_PERMISSIONS.read]),
      http.get(endpoint, () => ok(page([]))),
    );
    renderInventory(<CycleCountList />);
    await screen.findByText(CYCLE_COUNT_LABELS.noCounts);
    expect(screen.queryByRole("button", { name: C.action })).toBeNull();
  });

  it("a manager with inventory-cycle-counts:CREATE gets Lập phiếu on the toolbar, which opens the dialog", async () => {
    handlers(() => ok({}));
    const user = userEvent.setup();
    renderInventory(<CycleCountList />);
    await screen.findByText(CYCLE_COUNT_LABELS.noCounts);
    await user.click(screen.getByRole("button", { name: C.action }));
    expect(
      within(await screen.findByRole("dialog")).getByRole("heading", { name: C.title }),
    ).toBeInTheDocument();
  });

  it("an empty scope is refused on the form and nothing is sent", async () => {
    const plan = vi.fn(() => ok({}));
    handlers(plan);
    const user = userEvent.setup();
    renderInventory(<CycleCountList />);
    await user.click(await screen.findByRole("button", { name: C.action }));
    const dialog = await screen.findByRole("dialog");
    // A tall form scrolls inside the dialog: the fields do, the Lập phiếu button stays reachable on a 768 px screen
    expect(within(dialog).getByLabelText(C.skus).closest(".overflow-y-auto")).not.toBeNull();
    expect(
      within(dialog).getByRole("button", { name: C.action }).closest(".overflow-y-auto"),
    ).toBeNull();
    expectNoWarehousePicker(dialog);
    await user.click(within(dialog).getByRole("button", { name: C.action }));
    expect(await within(dialog).findByText(C.anyScope)).toBeInTheDocument();
    expect(plan).not.toHaveBeenCalled();
  });

  it("sends the warehouse, the scope as lists, blind by default and the sheet opens; skipped cartons are told", async () => {
    const bodies: unknown[] = [];
    const planned = cycleCountFixture({ countNumber: "CC-NEW-1", blind: true });
    handlers((body) => {
      bodies.push(body);
      return ok({ count: planned, skipped: [{ locationCode: "HCM-A01-1-B", sku: "MUG-RED" }] });
    });
    const user = userEvent.setup();
    renderInventory(<CycleCountList />);
    await user.click(await screen.findByRole("button", { name: C.action }));
    const dialog = await screen.findByRole("dialog");
    expectNoWarehousePicker(dialog);
    await user.click(await within(dialog).findByRole("checkbox", { name: "Khu A" }));
    await user.type(within(dialog).getByLabelText(C.shelves), "A01, A02");
    await user.type(within(dialog).getByLabelText(C.skus), "MUG-RED\nMUG-BLUE");
    await user.type(within(dialog).getByLabelText(C.note), "  Kiểm kê cuối tháng ");
    await user.click(within(dialog).getByRole("button", { name: C.action }));
    await waitFor(() =>
      expect(navigation.push).toHaveBeenCalledWith(
        `/admin/warehouse-map/HCM/cycle-counts/${planned.id}`,
      ),
    );
    expect(bodies).toEqual([
      {
        warehouseId: WAREHOUSE,
        blind: true,
        note: "Kiểm kê cuối tháng",
        // The BE's PlanCycleCountRequest: the lists go inside `scope`
        scope: {
          zoneIds: [ZONE],
          shelfCodes: ["A01", "A02"],
          locationCodes: [],
          skus: ["MUG-RED", "MUG-BLUE"],
        },
      },
    ]);
  });

  it("a scope over 500 cartons: the BE refusal reads as such, in the dialog", async () => {
    handlers(() =>
      HttpResponse.json(
        { success: false, errorCode: "CYCLE_COUNT_TOO_LARGE", message: "x" },
        { status: 422 },
      ),
    );
    const user = userEvent.setup();
    renderInventory(<CycleCountList />);
    await user.click(await screen.findByRole("button", { name: C.action }));
    const dialog = await screen.findByRole("dialog");
    expectNoWarehousePicker(dialog);
    await user.type(within(dialog).getByLabelText(C.skus), "MUG-RED");
    await user.click(within(dialog).getByRole("button", { name: C.action }));
    expect(await within(dialog).findByText(C.tooLarge)).toBeInTheDocument();
    expect(navigation.push).not.toHaveBeenCalled();
  });
});
