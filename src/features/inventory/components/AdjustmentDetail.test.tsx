import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  INVENTORY_ERROR_MESSAGES,
  INVENTORY_ERROR_TITLES,
  INVENTORY_LABELS,
} from "@/constants/inventory";
import { INVENTORY_PERMISSIONS } from "@/constants/permissions";
import { STOCK_ADJUSTMENT_STATUS } from "@/constants/statuses";

import { installInventoryTestApiContract } from "../test-api-contract";
import {
  adjustmentFixture,
  inventoryPermissions,
  renderInventory,
  setInventoryTestActor,
} from "../test-support";
import { AdjustmentDetail } from "./AdjustmentDetail";

const server = setupServer();
let restoreApiContract: () => void;
const endpoint = "http://localhost/api/v1/inventory/adjustments/:id";
const { adjustmentRead, adjustmentApprove, stockUpdate } = INVENTORY_PERMISSIONS;
const decisionButtons = [
  INVENTORY_LABELS.approve,
  INVENTORY_LABELS.reject,
  INVENTORY_LABELS.withdraw,
] as const;
beforeAll(() => {
  restoreApiContract = installInventoryTestApiContract();
  server.listen({ onUnhandledRequest: "error" });
});
beforeEach(() => {
  localStorage.clear();
  setInventoryTestActor("Warehouse Manager");
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => {
  server.close();
  restoreApiContract();
});

function serve(fixture: ReturnType<typeof adjustmentFixture>) {
  return http.get(endpoint, () => HttpResponse.json({ success: true, data: fixture }));
}

function expectNoDecisionControls() {
  decisionButtons.forEach((name) =>
    expect(screen.queryByRole("button", { name })).not.toBeInTheDocument(),
  );
}

describe("adjustment detail", () => {
  it("approves another request and removes all actions after posting", async () => {
    let fixture = adjustmentFixture();
    server.use(
      inventoryPermissions([adjustmentRead, adjustmentApprove]),
      http.get(endpoint, () => HttpResponse.json({ success: true, data: fixture })),
      http.post(`${endpoint}/approval`, () => {
        fixture = {
          ...fixture,
          status: STOCK_ADJUSTMENT_STATUS.POSTED,
          postedAt: "2026-10-11T00:01:00Z",
        };
        return HttpResponse.json({ success: true, data: fixture });
      }),
    );
    renderInventory(<AdjustmentDetail id={fixture.adjustmentId} />);
    await userEvent.click(await screen.findByRole("button", { name: INVENTORY_LABELS.approve }));
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: INVENTORY_LABELS.approve }),
    );
    expect(await screen.findByText("Đã ghi sổ")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: INVENTORY_LABELS.approve }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole("button", { name: INVENTORY_LABELS.reject })).not.toBeInTheDocument();
  });

  it("requester with UPDATE and APPROVE can withdraw but cannot decide", async () => {
    const requester = setInventoryTestActor("Warehouse Manager");
    const fixture = adjustmentFixture({ requestedBy: requester });
    server.use(
      inventoryPermissions([adjustmentRead, adjustmentApprove, stockUpdate]),
      serve(fixture),
    );
    renderInventory(<AdjustmentDetail id={fixture.adjustmentId} />);
    expect(
      await screen.findByRole("button", { name: INVENTORY_LABELS.withdraw }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: INVENTORY_LABELS.approve }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: INVENTORY_LABELS.reject })).not.toBeInTheDocument();
  });

  it("requester without stock UPDATE cannot withdraw", async () => {
    const requester = setInventoryTestActor("Warehouse Staff");
    const fixture = adjustmentFixture({ requestedBy: requester });
    server.use(inventoryPermissions([adjustmentRead]), serve(fixture));
    renderInventory(<AdjustmentDetail id={fixture.adjustmentId} />);
    await screen.findByText(fixture.number);
    expectNoDecisionControls();
  });

  it("UPDATE does not let another user withdraw someone else's request", async () => {
    setInventoryTestActor("Warehouse Staff");
    const fixture = adjustmentFixture();
    server.use(inventoryPermissions([adjustmentRead, stockUpdate]), serve(fixture));
    renderInventory(<AdjustmentDetail id={fixture.adjustmentId} />);
    await screen.findByText(fixture.number);
    expectNoDecisionControls();
  });

  it("requires a rejection reason and keeps server failure visible", async () => {
    const fixture = adjustmentFixture();
    server.use(
      inventoryPermissions([adjustmentRead, adjustmentApprove]),
      serve(fixture),
      http.post(`${endpoint}/rejection`, () =>
        HttpResponse.json(
          { success: false, errorCode: "CONFLICT", message: "Already decided" },
          { status: 409 },
        ),
      ),
    );
    renderInventory(<AdjustmentDetail id={fixture.adjustmentId} />);
    await userEvent.click(await screen.findByRole("button", { name: INVENTORY_LABELS.reject }));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByRole("button", { name: INVENTORY_LABELS.reject })).toBeDisabled();
    await userEvent.type(dialog.getByLabelText(/Lý do từ chối/), "Audit disagrees");
    await userEvent.click(dialog.getByRole("button", { name: INVENTORY_LABELS.reject }));
    expect(await screen.findByRole("alert")).toHaveTextContent(INVENTORY_ERROR_MESSAGES.conflict);
    expect(screen.queryByText(/Already decided/)).not.toBeInTheDocument();
  });

  it("READ only sees detail without decision controls", async () => {
    setInventoryTestActor("Inventory Planner");
    const fixture = adjustmentFixture();
    server.use(inventoryPermissions([adjustmentRead]), serve(fixture));
    renderInventory(<AdjustmentDetail id={fixture.adjustmentId} />);
    await screen.findByText(fixture.number);
    expectNoDecisionControls();
  });

  it("a formerly privileged role without APPROVE cannot decide", async () => {
    setInventoryTestActor("System Admin");
    const fixture = adjustmentFixture();
    server.use(
      inventoryPermissions([adjustmentRead, stockUpdate], ["SYSTEM_ADMIN"]),
      serve(fixture),
    );
    renderInventory(<AdjustmentDetail id={fixture.adjustmentId} />);
    await screen.findByText(fixture.number);
    expectNoDecisionControls();
  });

  it("a non-allowlisted role with APPROVE can decide another request", async () => {
    setInventoryTestActor("Sales Staff");
    const fixture = adjustmentFixture();
    server.use(
      inventoryPermissions([adjustmentRead, adjustmentApprove], ["SALES_STAFF"]),
      serve(fixture),
    );
    renderInventory(<AdjustmentDetail id={fixture.adjustmentId} />);
    expect(
      await screen.findByRole("button", { name: INVENTORY_LABELS.approve }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: INVENTORY_LABELS.reject })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: INVENTORY_LABELS.withdraw }),
    ).not.toBeInTheDocument();
  });

  it("a formerly privileged role without adjustment READ is denied and nothing is fetched", async () => {
    const fetched = vi.fn();
    const fixture = adjustmentFixture();
    server.use(
      inventoryPermissions([adjustmentApprove, stockUpdate], ["WAREHOUSE_MANAGER"]),
      http.get(endpoint, () => {
        fetched();
        return HttpResponse.json({ success: true, data: fixture });
      }),
    );
    renderInventory(<AdjustmentDetail id={fixture.adjustmentId} />);
    expect(await screen.findByText(INVENTORY_LABELS.denied)).toBeInTheDocument();
    expect(screen.queryByText(fixture.number)).not.toBeInTheDocument();
    expect(fetched).not.toHaveBeenCalled();
  });

  it("renders unknown backend reason/status verbatim with no lifecycle action", async () => {
    const fixture = adjustmentFixture({ reason: "COUNT_VARIANCE", status: "APPROVED" });
    server.use(
      inventoryPermissions([adjustmentRead, adjustmentApprove, stockUpdate]),
      serve(fixture),
    );
    renderInventory(<AdjustmentDetail id={fixture.adjustmentId} />);
    expect(await screen.findByText("COUNT_VARIANCE")).toBeInTheDocument();
    expect(screen.getByTitle(/APPROVED/)).toBeInTheDocument();
    expectNoDecisionControls();
  });

  it("shows Vietnamese not-found for STOCK_ADJUSTMENT_NOT_FOUND, never the backend text", async () => {
    server.use(
      inventoryPermissions([adjustmentRead]),
      http.get(endpoint, () =>
        HttpResponse.json(
          {
            success: false,
            errorCode: "STOCK_ADJUSTMENT_NOT_FOUND",
            message: "No stock adjustment 123",
            correlationId: "detail-404",
          },
          { status: 404 },
        ),
      ),
    );
    renderInventory(<AdjustmentDetail id={crypto.randomUUID()} />);
    expect(await screen.findByText(INVENTORY_ERROR_TITLES.adjustmentNotFound)).toBeInTheDocument();
    expect(screen.getByText(INVENTORY_ERROR_MESSAGES.adjustmentNotFound)).toBeInTheDocument();
    expect(screen.getByText(/detail-404/)).toBeInTheDocument();
    expect(screen.queryByText(/No stock adjustment/)).not.toBeInTheDocument();
    expect(screen.queryByText(INVENTORY_LABELS.loadError)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: INVENTORY_LABELS.retry })).not.toBeInTheDocument();
  });

  it("maps INSUFFICIENT_STOCK on approval and does not refetch a still-valid detail", async () => {
    const fixture = adjustmentFixture();
    let reads = 0;
    server.use(
      inventoryPermissions([adjustmentRead, adjustmentApprove]),
      http.get(endpoint, () => {
        reads += 1;
        return HttpResponse.json({ success: true, data: fixture });
      }),
      http.post(`${endpoint}/approval`, () =>
        HttpResponse.json(
          {
            success: false,
            errorCode: "INSUFFICIENT_STOCK",
            message: "Not enough available stock",
            correlationId: "approve-stock",
          },
          { status: 409 },
        ),
      ),
    );
    renderInventory(<AdjustmentDetail id={fixture.adjustmentId} />);
    await userEvent.click(await screen.findByRole("button", { name: INVENTORY_LABELS.approve }));
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: INVENTORY_LABELS.approve }),
    );
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(INVENTORY_ERROR_MESSAGES.insufficientStock);
    expect(alert).toHaveTextContent("approve-stock");
    expect(screen.queryByText(/Not enough available stock/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: INVENTORY_LABELS.approve })).toBeInTheDocument();
    expect(reads).toBe(1);
  });

  it("INVALID_ADJUSTMENT_TRANSITION refetches the detail and removes stale actions", async () => {
    let fixture = adjustmentFixture();
    let reads = 0;
    server.use(
      inventoryPermissions([adjustmentRead, adjustmentApprove]),
      http.get(endpoint, () => {
        reads += 1;
        return HttpResponse.json({ success: true, data: fixture });
      }),
      http.post(`${endpoint}/approval`, () => {
        // Another approver decided it first.
        fixture = {
          ...fixture,
          status: STOCK_ADJUSTMENT_STATUS.REJECTED,
          decidedBy: crypto.randomUUID(),
          decidedAt: "2026-10-11T00:01:00Z",
          rejectionReason: "Decided by a peer",
        };
        return HttpResponse.json(
          {
            success: false,
            errorCode: "INVALID_ADJUSTMENT_TRANSITION",
            message: "Adjustment is already REJECTED",
          },
          { status: 409 },
        );
      }),
    );
    renderInventory(<AdjustmentDetail id={fixture.adjustmentId} />);
    await userEvent.click(await screen.findByRole("button", { name: INVENTORY_LABELS.approve }));
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: INVENTORY_LABELS.approve }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(INVENTORY_ERROR_MESSAGES.transition);
    await waitFor(() => expect(reads).toBe(2));
    expect(await screen.findByText("Decided by a peer")).toBeInTheDocument();
    expect(screen.getByText("Từ chối")).toBeInTheDocument();
    expect(screen.queryByText("NCC từ chối")).not.toBeInTheDocument();
    expectNoDecisionControls();
    expect(screen.queryByText(/already REJECTED/)).not.toBeInTheDocument();
  });

  it("ADJUSTMENT_SELF_APPROVAL refetches and Step 3 rules leave the requester only withdraw", async () => {
    const actor = setInventoryTestActor("Warehouse Manager");
    let fixture = adjustmentFixture();
    let reads = 0;
    server.use(
      inventoryPermissions([adjustmentRead, adjustmentApprove, stockUpdate]),
      http.get(endpoint, () => {
        reads += 1;
        return HttpResponse.json({ success: true, data: fixture });
      }),
      http.post(`${endpoint}/rejection`, () => {
        // The server knows this actor requested it; the page's copy was behind.
        fixture = { ...fixture, requestedBy: actor };
        return HttpResponse.json(
          { success: false, errorCode: "ADJUSTMENT_SELF_APPROVAL", message: "Four eyes" },
          { status: 409 },
        );
      }),
    );
    renderInventory(<AdjustmentDetail id={fixture.adjustmentId} />);
    await userEvent.click(await screen.findByRole("button", { name: INVENTORY_LABELS.reject }));
    const dialog = within(screen.getByRole("dialog"));
    await userEvent.type(dialog.getByLabelText(/Lý do từ chối/), "Count mismatch");
    await userEvent.click(dialog.getByRole("button", { name: INVENTORY_LABELS.reject }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      INVENTORY_ERROR_MESSAGES.selfApproval,
    );
    await waitFor(() => expect(reads).toBe(2));
    expect(
      await screen.findByRole("button", { name: INVENTORY_LABELS.withdraw }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: INVENTORY_LABELS.approve }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: INVENTORY_LABELS.reject })).not.toBeInTheDocument();
    expect(screen.queryByText("Four eyes")).not.toBeInTheDocument();
  });
});
