import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { CYCLE_COUNT_API, CYCLE_COUNT_LABELS, CYCLE_COUNT_ROUTES } from "@/constants/cycle-count";
import { INVENTORY_LABELS } from "@/constants/inventory";
import { CYCLE_COUNT_PERMISSIONS } from "@/constants/permissions";

import {
  cycleCountSummaryFixture,
  inventoryEndpoint,
  inventoryPermissions,
  renderInventory,
  setInventoryTestActor,
} from "../test-support";
import { CycleCountList } from "./CycleCountList";

const server = setupServer();
const endpoint = inventoryEndpoint(CYCLE_COUNT_API.list);
const { viewPage, read } = CYCLE_COUNT_PERMISSIONS;
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
    expect(link).toHaveAttribute("href", CYCLE_COUNT_ROUTES.detail(shortPick.id));
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
    server.use(
      inventoryPermissions([viewPage, read]),
      http.get(endpoint, ({ request }) => {
        statuses(new URL(request.url).searchParams.get("status"));
        return HttpResponse.json({ success: true, data: page([]) });
      }),
    );
    renderInventory(<CycleCountList />, "?status=IN_PROGRESS");
    await screen.findByText(INVENTORY_LABELS.noResults);
    expect(statuses).toHaveBeenLastCalledWith("IN_PROGRESS");
    // The toolbar reset and the empty state offer the same way out.
    const [reset] = screen.getAllByRole("button", { name: INVENTORY_LABELS.reset });
    if (!reset) throw new Error("reset not rendered");
    await userEvent.click(reset);
    await screen.findByText(CYCLE_COUNT_LABELS.noCounts);
    expect(statuses).toHaveBeenLastCalledWith(null);
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
