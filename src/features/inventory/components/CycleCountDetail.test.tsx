import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CYCLE_COUNT_API,
  CYCLE_COUNT_ERROR_MESSAGES,
  CYCLE_COUNT_LABELS as L,
  CYCLE_COUNT_ROUTES,
} from "@/constants/cycle-count";
import { INVENTORY_LABELS, INVENTORY_ROUTES } from "@/constants/inventory";
import { CYCLE_COUNT_PERMISSIONS, INVENTORY_PERMISSIONS } from "@/constants/permissions";

import {
  cycleCountFixture,
  cycleCountLineFixture,
  inventoryEndpoint,
  inventoryPermissions,
  renderInventory,
  setInventoryTestActor,
} from "../test-support";
import { CycleCountDetail } from "./CycleCountDetail";

import type { CycleCount } from "../cycle-count-types";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));

const server = setupServer();
const P = CYCLE_COUNT_PERMISSIONS;
// Seeded grants (BE V20260903000100, V20261023000300, V20261028001000): the counter reads and counts, the manager
// also plans and decides.
const COUNTER = [P.viewPage, P.read, P.update];
const MANAGER = [P.viewPage, P.read, P.create, P.update, P.approve];
const BIN = "HCM-A01-1-B";
const LPN = "LPN-20261110-000001";

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => undefined;
  Element.prototype.scrollIntoView ??= () => undefined;
});
beforeEach(() => {
  localStorage.clear();
  navigation.push.mockClear();
  setInventoryTestActor("Warehouse Staff");
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const detail = (count: CycleCount) => inventoryEndpoint(CYCLE_COUNT_API.detail(count.id));
const ok = (data: unknown, status = 200) => HttpResponse.json({ success: true, data }, { status });
const fail = (errorCode: string, status: number) =>
  HttpResponse.json({ success: false, errorCode, message: "English backend prose" }, { status });

/** Serve a mutable sheet; every write handler may return the next state. */
function serveSheet(initial: CycleCount, permissions: string[]) {
  let sheet = initial;
  server.use(
    inventoryPermissions(permissions as never),
    http.get(detail(initial), () => ok(sheet)),
  );
  return {
    get current() {
      return sheet;
    },
    set(next: CycleCount) {
      sheet = next;
    },
  };
}

// The scan box announces its result twice on purpose (a live region for screen readers + the visible line).
async function expectFeedback(text: string) {
  expect((await screen.findAllByText(text)).length).toBeGreaterThan(0);
}

async function scan(label: string, code: string) {
  const input = await screen.findByLabelText(label);
  await userEvent.type(input, `${code}{Enter}`);
}

describe("blind count by a counter (docs 20 §4.2 b, BR-07)", () => {
  const sheet = () =>
    cycleCountFixture({
      status: "PLANNED",
      blind: true,
      lines: [cycleCountLineFixture({ lpn: LPN, locationCode: BIN })],
    });

  it("lists the cartons to find without the books, the note or any variance", async () => {
    const count = sheet();
    serveSheet(count, COUNTER);
    renderInventory(<CycleCountDetail id={count.id} />);
    expect(await screen.findByRole("heading", { name: count.countNumber })).toBeInTheDocument();
    expect(screen.getByText(L.blindHint)).toBeInTheDocument();
    const row = screen.getByText(LPN).closest("tr");
    if (!row) throw new Error("line not rendered");
    expect(within(row).getByText(BIN)).toBeInTheDocument();
    expect(within(row).getByText(L.lineState.pending)).toBeInTheDocument();
    // No books column, no variance column, no note, no quantity field anywhere.
    expect(screen.queryByRole("columnheader", { name: L.booked })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: L.variance })).not.toBeInTheDocument();
    expect(screen.queryByText(L.bookedYes)).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    // Cancel and recount belong to whoever decides counts.
    expect(screen.queryByRole("button", { name: L.cancel })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.recount })).not.toBeInTheDocument();
  });

  it("scan the location, then the carton: the line is counted present with `found: true`", async () => {
    const count = sheet();
    const server$ = serveSheet(count, COUNTER);
    const lineId = count.lines[0]?.id ?? "";
    const bodies = vi.fn();
    server.use(
      http.put(inventoryEndpoint(CYCLE_COUNT_API.line(count.id, lineId)), async ({ request }) => {
        bodies(await request.json());
        const next = {
          ...count,
          status: "IN_PROGRESS",
          lines: [{ ...cycleCountLineFixture({ ...count.lines[0], found: true }) }],
        };
        server$.set(next);
        return ok(next);
      }),
    );
    renderInventory(<CycleCountDetail id={count.id} />);
    // Step 1 asks for the location; step 2 for the carton.
    await scan(L.scanLocation, BIN);
    await expectFeedback(L.scanLocationSet(BIN));
    await scan(L.scanCarton, LPN.toLowerCase());
    await waitFor(() => expect(bodies).toHaveBeenCalledWith({ found: true }));
    await expectFeedback(L.scanPresent(LPN));
    const row = screen.getByText(LPN).closest("tr");
    if (!row) throw new Error("line not rendered");
    expect(await within(row).findByText(L.lineState.present)).toBeInTheDocument();
    // Every carton is counted now: the sheet can be submitted.
    expect(screen.getByRole("button", { name: L.submit })).toBeEnabled();
  });

  it("a carton the plan did not list is added at the scanned bin with its LPN", async () => {
    const count = sheet();
    const added = vi.fn();
    const server$ = serveSheet(count, COUNTER);
    server.use(
      http.post(inventoryEndpoint(CYCLE_COUNT_API.addLine(count.id)), async ({ request }) => {
        added(await request.json());
        const next = {
          ...count,
          lines: [
            ...count.lines,
            cycleCountLineFixture({ lpn: "LPN-NEW", locationCode: BIN, found: true }),
          ],
        };
        server$.set(next);
        return ok(next);
      }),
    );
    renderInventory(<CycleCountDetail id={count.id} />);
    await scan(L.scanLocation, BIN);
    await scan(L.scanCarton, "lpn-new");
    await waitFor(() => expect(added).toHaveBeenCalledWith({ locationCode: BIN, lpn: "LPN-NEW" }));
    await expectFeedback(L.scanAdded("LPN-NEW"));
    expect(await screen.findByText("LPN-NEW")).toBeInTheDocument();
  });

  it("a carton listed at another bin is reported and never counted (docs 20 §4.2 b5, §6)", async () => {
    const count = cycleCountFixture({
      blind: true,
      lines: [cycleCountLineFixture({ lpn: LPN, locationCode: "HCM-A01-2-A" })],
    });
    serveSheet(count, COUNTER);
    let writes = 0;
    server.use(
      http.put(/\/cycle-counts\/.+\/count$/, () => {
        writes += 1;
        return ok(count);
      }),
      http.post(/\/cycle-counts\/.+\/lines$/, () => {
        writes += 1;
        return ok(count);
      }),
    );
    renderInventory(<CycleCountDetail id={count.id} />);
    await scan(L.scanLocation, BIN);
    await scan(L.scanCarton, LPN);
    await expectFeedback(L.scanWrongLocation(LPN, "HCM-A01-2-A"));
    expect(writes).toBe(0);
  });

  it("a carton that is not on the shelf is reported not found with `found: false`", async () => {
    const count = sheet();
    const server$ = serveSheet(count, COUNTER);
    const lineId = count.lines[0]?.id ?? "";
    const bodies = vi.fn();
    server.use(
      http.put(inventoryEndpoint(CYCLE_COUNT_API.line(count.id, lineId)), async ({ request }) => {
        bodies(await request.json());
        const next = {
          ...count,
          status: "IN_PROGRESS",
          lines: [cycleCountLineFixture({ ...count.lines[0], found: false })],
        };
        server$.set(next);
        return ok(next);
      }),
    );
    renderInventory(<CycleCountDetail id={count.id} />);
    await userEvent.click(await screen.findByRole("button", { name: L.markMissingFor(LPN) }));
    await waitFor(() => expect(bodies).toHaveBeenCalledWith({ found: false }));
    const row = screen.getByText(LPN).closest("tr");
    if (!row) throw new Error("line not rendered");
    expect(await within(row).findByText(L.lineState.missing)).toBeInTheDocument();
    // Once not found, the button is gone from that line.
    expect(screen.queryByRole("button", { name: L.markMissingFor(LPN) })).not.toBeInTheDocument();
  });

  it("will not submit while a carton is still uncounted, and says why", async () => {
    const count = sheet();
    serveSheet(count, COUNTER);
    renderInventory(<CycleCountDetail id={count.id} />);
    expect(await screen.findByRole("button", { name: L.submit })).toBeDisabled();
    expect(screen.getByText(L.submitBlocked)).toBeInTheDocument();
  });

  it("submits a fully counted sheet; it becomes Completed and nothing can be counted any more", async () => {
    const counted = cycleCountFixture({
      status: "IN_PROGRESS",
      lines: [cycleCountLineFixture({ lpn: LPN, locationCode: BIN, found: false })],
    });
    const server$ = serveSheet(counted, COUNTER);
    const submitted = vi.fn();
    server.use(
      http.post(inventoryEndpoint(CYCLE_COUNT_API.submission(counted.id)), () => {
        submitted();
        const next = { ...counted, status: "COMPLETED", completedAt: "2026-11-12T03:00:00Z" };
        server$.set(next);
        return ok(next);
      }),
    );
    renderInventory(<CycleCountDetail id={counted.id} />);
    await userEvent.click(await screen.findByRole("button", { name: L.submit }));
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: L.submit }),
    );
    expect(await screen.findByText("Đã nộp")).toBeInTheDocument();
    expect(submitted).toHaveBeenCalledTimes(1);
    // Completed: no scan box, no per-line buttons, no submit; a counter has no recount either.
    expect(screen.queryByLabelText(L.scanLocation)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.markMissingFor(LPN) })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.submit })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.recount })).not.toBeInTheDocument();
  });

  it("explains in Vietnamese when the submit is refused, never the backend text", async () => {
    const counted = cycleCountFixture({
      lines: [cycleCountLineFixture({ lpn: LPN, locationCode: BIN, found: true })],
    });
    serveSheet(counted, COUNTER);
    server.use(
      http.post(inventoryEndpoint(CYCLE_COUNT_API.submission(counted.id)), () =>
        fail("CYCLE_COUNT_STALE", 409),
      ),
    );
    renderInventory(<CycleCountDetail id={counted.id} />);
    await userEvent.click(await screen.findByRole("button", { name: L.submit }));
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: L.submit }),
    );
    expect(await screen.findByText(CYCLE_COUNT_ERROR_MESSAGES.stale)).toBeInTheDocument();
    expect(screen.queryByText(/English backend prose/)).not.toBeInTheDocument();
  });

  it("tells the counter a carton cannot be counted without saying where the books keep it", async () => {
    const count = sheet();
    serveSheet(count, COUNTER);
    server.use(
      http.post(inventoryEndpoint(CYCLE_COUNT_API.addLine(count.id)), () =>
        fail("STOCK_PACKAGE_WRONG_LOCATION", 422),
      ),
    );
    renderInventory(<CycleCountDetail id={count.id} />);
    await scan(L.scanLocation, BIN);
    await scan(L.scanCarton, "LPN-ELSEWHERE");
    await expectFeedback(CYCLE_COUNT_ERROR_MESSAGES.wrongLocation);
  });

  it("assigned to someone else: the backend refuses and the counter is told so", async () => {
    const count = sheet();
    serveSheet(count, COUNTER);
    const lineId = count.lines[0]?.id ?? "";
    server.use(
      http.put(inventoryEndpoint(CYCLE_COUNT_API.line(count.id, lineId)), () =>
        fail("CYCLE_COUNT_NOT_ASSIGNEE", 403),
      ),
    );
    renderInventory(<CycleCountDetail id={count.id} />);
    await userEvent.click(await screen.findByRole("button", { name: L.markMissingFor(LPN) }));
    expect(await screen.findByText(CYCLE_COUNT_ERROR_MESSAGES.notAssignee)).toBeInTheDocument();
  });
});

describe("the manager's view (docs 20 §4.2 d–e, BR-07)", () => {
  const ADJ = "d0000001-0000-4000-8000-0000000000e1";
  const rejectedLine = cycleCountLineFixture({
    lpn: LPN,
    locationCode: BIN,
    booked: true,
    found: false,
    adjustments: [
      { id: ADJ, number: "ADJ-20261112-0001", quantityDelta: -120, status: "REJECTED" },
    ],
  });
  const postedLine = cycleCountLineFixture({
    lpn: "LPN-OK",
    locationCode: BIN,
    booked: true,
    found: true,
  });

  beforeEach(() => setInventoryTestActor("Warehouse Manager"));

  it("sees the books, the variance and a link to each COUNT_VARIANCE adjustment", async () => {
    const count = cycleCountFixture({
      status: "COMPLETED",
      note: "Báo thiếu thùng khi lấy hàng",
      lines: [rejectedLine, postedLine],
    });
    serveSheet(count, [...MANAGER, INVENTORY_PERMISSIONS.adjustmentRead]);
    renderInventory(<CycleCountDetail id={count.id} />);
    expect(await screen.findByText("Báo thiếu thùng khi lấy hàng")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: L.booked })).toBeInTheDocument();
    const shortRow = screen.getByText(LPN).closest("tr");
    if (!shortRow) throw new Error("line not rendered");
    expect(within(shortRow).getByText(L.bookedYes)).toBeInTheDocument();
    expect(within(shortRow).getByText(L.shortage)).toBeInTheDocument();
    expect(within(shortRow).getByRole("link", { name: "ADJ-20261112-0001" })).toHaveAttribute(
      "href",
      INVENTORY_ROUTES.adjustment(ADJ),
    );
    const okRow = screen.getByText("LPN-OK").closest("tr");
    if (!okRow) throw new Error("line not rendered");
    expect(within(okRow).getByText(L.noVariance)).toBeInTheDocument();
    // The way to the approver's queue.
    expect(screen.getByRole("link", { name: L.pendingAdjustments })).toHaveAttribute(
      "href",
      `${INVENTORY_ROUTES.adjustments}?status=PENDING_APPROVAL`,
    );
  });

  it("recounts only lines whose variance was rejected: a new blind sheet, the old one untouched", async () => {
    const count = cycleCountFixture({
      status: "COMPLETED",
      lines: [rejectedLine, postedLine],
    });
    serveSheet(count, MANAGER);
    const next = cycleCountFixture({ countNumber: "CC-RECOUNT", lines: [] });
    const bodies = vi.fn();
    server.use(
      http.post(inventoryEndpoint(CYCLE_COUNT_API.recounts(count.id)), async ({ request }) => {
        bodies(await request.json());
        return ok(next, 201);
      }),
    );
    renderInventory(<CycleCountDetail id={count.id} />);
    const pick = await screen.findByRole("checkbox", { name: L.recountPick(LPN) });
    // The posted line is not offered.
    expect(
      screen.queryByRole("checkbox", { name: L.recountPick("LPN-OK") }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: L.recount })).toBeDisabled();
    await userEvent.click(pick);
    await userEvent.click(screen.getByRole("button", { name: L.recount }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(L.recountNote), "Nghi đếm sai");
    await userEvent.click(within(dialog).getByRole("button", { name: L.recount }));
    await waitFor(() =>
      expect(bodies).toHaveBeenCalledWith({ lineIds: [rejectedLine.id], note: "Nghi đếm sai" }),
    );
    await waitFor(() =>
      expect(navigation.push).toHaveBeenCalledWith(CYCLE_COUNT_ROUTES.detail(next.id)),
    );
  });

  it("cancels an open sheet only with a reason", async () => {
    const count = cycleCountFixture({
      status: "IN_PROGRESS",
      lines: [cycleCountLineFixture({ lpn: LPN, locationCode: BIN, booked: true })],
    });
    const server$ = serveSheet(count, MANAGER);
    const bodies = vi.fn();
    server.use(
      http.post(inventoryEndpoint(CYCLE_COUNT_API.cancellation(count.id)), async ({ request }) => {
        bodies(await request.json());
        const cancelled = { ...count, status: "CANCELLED" };
        server$.set(cancelled);
        return ok(cancelled);
      }),
    );
    renderInventory(<CycleCountDetail id={count.id} />);
    await userEvent.click(await screen.findByRole("button", { name: L.cancel }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: L.cancel })).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText(/Lý do huỷ/), "Kho kiểm lại sau");
    await userEvent.click(within(dialog).getByRole("button", { name: L.cancel }));
    await waitFor(() => expect(bodies).toHaveBeenCalledWith({ reason: "Kho kiểm lại sau" }));
    expect(await screen.findByText("Đã huỷ")).toBeInTheDocument();
    // Cancelled is terminal: no scan box, no action.
    expect(screen.queryByLabelText(L.scanLocation)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.cancel })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.recount })).not.toBeInTheDocument();
  });

  it("a Completed sheet offers recount, not submit, scan or cancel", async () => {
    const count = cycleCountFixture({ status: "COMPLETED", lines: [rejectedLine] });
    serveSheet(count, MANAGER);
    renderInventory(<CycleCountDetail id={count.id} />);
    expect(await screen.findByRole("button", { name: L.recount })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.submit })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.cancel })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(L.scanLocation)).not.toBeInTheDocument();
  });
});

describe("permissions (codes, never role names)", () => {
  it("a reader without UPDATE sees the sheet but cannot count or submit", async () => {
    const count = cycleCountFixture({
      lines: [cycleCountLineFixture({ lpn: LPN, locationCode: BIN })],
    });
    serveSheet(count, [P.viewPage, P.read]);
    renderInventory(<CycleCountDetail id={count.id} />);
    expect(await screen.findByRole("heading", { name: count.countNumber })).toBeInTheDocument();
    expect(screen.queryByLabelText(L.scanLocation)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.markMissingFor(LPN) })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.submit })).not.toBeInTheDocument();
  });

  it.each([
    ["VIEW_PAGE alone", [P.viewPage]],
    ["READ alone", [P.read]],
  ] as const)("is denied with %s and never asks for the sheet", async (_, permissions) => {
    const count = cycleCountFixture();
    const fetched = vi.fn();
    server.use(
      inventoryPermissions([...permissions]),
      http.get(detail(count), () => {
        fetched();
        return ok(count);
      }),
    );
    renderInventory(<CycleCountDetail id={count.id} />);
    expect(await screen.findByText(INVENTORY_LABELS.denied)).toBeInTheDocument();
    expect(fetched).not.toHaveBeenCalled();
  });

  it("a sheet of another warehouse is a Vietnamese not-found, not the backend text", async () => {
    const count = cycleCountFixture();
    server.use(
      inventoryPermissions(COUNTER as never),
      http.get(detail(count), () => fail("NOT_FOUND", 404)),
    );
    renderInventory(<CycleCountDetail id={count.id} />);
    expect(await screen.findByText(/không tồn tại hoặc không thuộc phạm vi/i)).toBeInTheDocument();
    expect(screen.queryByText(/English backend prose/)).not.toBeInTheDocument();
  });
});
