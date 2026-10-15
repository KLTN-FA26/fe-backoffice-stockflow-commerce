import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { INVENTORY_LABELS } from "@/constants/inventory";
import { STOCK_ADJUSTMENT_STATUS } from "@/constants/statuses";

import { installInventoryTestApiContract } from "../test-api-contract";
import { adjustmentFixture, renderInventory, setInventoryTestActor } from "../test-support";
import { AdjustmentDetail } from "./AdjustmentDetail";

const server = setupServer();
let restoreApiContract: () => void;
const endpoint = "http://localhost/api/v1/inventory/adjustments/:id";
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

describe("adjustment detail", () => {
  it("approves another request and removes all actions after posting", async () => {
    let fixture = adjustmentFixture();
    server.use(
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

  it("requester can withdraw but cannot decide even as manager", async () => {
    const requester = setInventoryTestActor("Warehouse Manager");
    const fixture = adjustmentFixture({ requestedBy: requester });
    server.use(http.get(endpoint, () => HttpResponse.json({ success: true, data: fixture })));
    renderInventory(<AdjustmentDetail id={fixture.adjustmentId} />);
    expect(
      await screen.findByRole("button", { name: INVENTORY_LABELS.withdraw }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: INVENTORY_LABELS.approve }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: INVENTORY_LABELS.reject })).not.toBeInTheDocument();
  });

  it("requires a rejection reason and keeps server failure visible", async () => {
    const fixture = adjustmentFixture();
    server.use(
      http.get(endpoint, () => HttpResponse.json({ success: true, data: fixture })),
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
    expect(await screen.findByRole("alert")).toHaveTextContent("Already decided");
  });

  it("planner sees detail without decision controls", async () => {
    setInventoryTestActor("Inventory Planner");
    const fixture = adjustmentFixture();
    server.use(http.get(endpoint, () => HttpResponse.json({ success: true, data: fixture })));
    renderInventory(<AdjustmentDetail id={fixture.adjustmentId} />);
    await screen.findByText(fixture.number);
    expect(
      screen.queryByRole("button", { name: INVENTORY_LABELS.approve }),
    ).not.toBeInTheDocument();
  });

  it("renders unknown backend reason/status verbatim with no lifecycle action", async () => {
    const fixture = adjustmentFixture({ reason: "COUNT_VARIANCE", status: "APPROVED" });
    server.use(http.get(endpoint, () => HttpResponse.json({ success: true, data: fixture })));
    renderInventory(<AdjustmentDetail id={fixture.adjustmentId} />);
    expect(await screen.findByText("COUNT_VARIANCE")).toBeInTheDocument();
    expect(screen.getByTitle(/APPROVED/)).toBeInTheDocument();
    [INVENTORY_LABELS.approve, INVENTORY_LABELS.reject, INVENTORY_LABELS.withdraw].forEach((name) =>
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument(),
    );
  });
});
