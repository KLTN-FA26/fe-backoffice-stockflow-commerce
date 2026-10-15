import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  INVENTORY_ERROR_MESSAGES,
  INVENTORY_LABELS,
  INVENTORY_ROUTES,
} from "@/constants/inventory";
import { INVENTORY_PERMISSIONS } from "@/constants/permissions";

import { installInventoryTestApiContract } from "../test-api-contract";
import {
  adjustmentFixture,
  inventoryPermissions,
  renderInventory,
  setInventoryTestActor,
} from "../test-support";
import { AdjustmentCreate } from "./AdjustmentCreate";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
const server = setupServer();
let restoreApiContract: () => void;
const endpoint = "http://localhost/api/v1/inventory/adjustments";
beforeAll(() => {
  restoreApiContract = installInventoryTestApiContract();
  server.listen({ onUnhandledRequest: "error" });
});
beforeEach(() => {
  localStorage.clear();
  navigation.push.mockClear();
  setInventoryTestActor("Warehouse Staff");
  server.use(inventoryPermissions([INVENTORY_PERMISSIONS.stockUpdate]));
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => {
  server.close();
  restoreApiContract();
});

async function enterAdjustment() {
  await userEvent.type(await screen.findByLabelText(/Vị trí/), "HCM-A01-1-A");
  await userEvent.type(screen.getByLabelText(/SKU/), "CUP-PP-500");
  await userEvent.type(screen.getByLabelText(/Chênh lệch số lượng/), "-3");
}

describe("adjustment create form", () => {
  it("requires a reason before submitting", async () => {
    renderInventory(<AdjustmentCreate />);
    await enterAdjustment();
    expect(screen.getByRole("button", { name: INVENTORY_LABELS.submitAdjustment })).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText(/Lý do điều chỉnh/), "SCRAP");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: INVENTORY_LABELS.submitAdjustment })).toBeEnabled(),
    );
  });

  it("sends the contract payload and opens the returned detail", async () => {
    const fixture = adjustmentFixture();
    const submitted = vi.fn();
    server.use(
      http.post(endpoint, async ({ request }) => {
        submitted(await request.json());
        return HttpResponse.json({ success: true, data: fixture }, { status: 201 });
      }),
    );
    renderInventory(<AdjustmentCreate />);
    await enterAdjustment();
    await userEvent.selectOptions(screen.getByLabelText(/Lý do điều chỉnh/), "SCRAP");
    await userEvent.click(screen.getByRole("button", { name: INVENTORY_LABELS.submitAdjustment }));
    await waitFor(() =>
      expect(navigation.push).toHaveBeenCalledWith(
        INVENTORY_ROUTES.adjustment(fixture.adjustmentId),
      ),
    );
    expect(submitted).toHaveBeenCalledWith({
      locationCode: "HCM-A01-1-A",
      sku: "CUP-PP-500",
      quantityDelta: -3,
      reason: "SCRAP",
    });
  });

  it("requires an explanation for OTHER", async () => {
    renderInventory(<AdjustmentCreate />);
    await enterAdjustment();
    await userEvent.selectOptions(screen.getByLabelText(/Lý do điều chỉnh/), "OTHER");
    expect(await screen.findByText("Cần giải thích khi chọn lý do khác.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: INVENTORY_LABELS.submitAdjustment })).toBeDisabled();
    await userEvent.type(screen.getByLabelText(INVENTORY_LABELS.note), "Recount after audit");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: INVENTORY_LABELS.submitAdjustment })).toBeEnabled(),
    );
  });

  it("maps backend validation back to the input", async () => {
    server.use(
      http.post(endpoint, () =>
        HttpResponse.json(
          {
            success: false,
            errorCode: "VALIDATION_FAILED",
            message: "Unknown stock row",
            fieldErrors: [{ field: "locationCode", message: "Unknown location" }],
            correlationId: "create-test",
          },
          { status: 422 },
        ),
      ),
    );
    renderInventory(<AdjustmentCreate />);
    await enterAdjustment();
    await userEvent.selectOptions(screen.getByLabelText(/Lý do điều chỉnh/), "SCRAP");
    await userEvent.click(screen.getByRole("button", { name: INVENTORY_LABELS.submitAdjustment }));
    expect(await screen.findByText("Unknown location")).toBeInTheDocument();
    expect(screen.getByLabelText(/Vị trí/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/create-test/)).toBeInTheDocument();
    expect(screen.getByText(INVENTORY_ERROR_MESSAGES.validation)).toBeInTheDocument();
    expect(screen.queryByText("Unknown stock row")).not.toBeInTheDocument();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("names the missing stock row, not the adjustment, for STOCK_ITEM_NOT_FOUND", async () => {
    server.use(
      http.post(endpoint, () =>
        HttpResponse.json(
          {
            success: false,
            errorCode: "STOCK_ITEM_NOT_FOUND",
            message: "No CUP-PP-500 at HCM-A01-1-A",
          },
          { status: 404 },
        ),
      ),
    );
    renderInventory(<AdjustmentCreate />);
    await enterAdjustment();
    await userEvent.selectOptions(screen.getByLabelText(/Lý do điều chỉnh/), "SCRAP");
    await userEvent.click(screen.getByRole("button", { name: INVENTORY_LABELS.submitAdjustment }));
    expect(await screen.findByText(INVENTORY_ERROR_MESSAGES.stockItemNotFound)).toBeInTheDocument();
    expect(screen.queryByText(/No CUP-PP-500/)).not.toBeInTheDocument();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("a formerly privileged role without stock UPDATE cannot create", async () => {
    setInventoryTestActor("System Admin");
    server.use(
      inventoryPermissions(
        [INVENTORY_PERMISSIONS.adjustmentRead, INVENTORY_PERMISSIONS.adjustmentApprove],
        ["SYSTEM_ADMIN"],
      ),
    );
    renderInventory(<AdjustmentCreate />);
    expect(await screen.findByText(INVENTORY_LABELS.denied)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: INVENTORY_LABELS.submitAdjustment }),
    ).not.toBeInTheDocument();
  });

  it("a non-allowlisted role with stock UPDATE gets the create form", async () => {
    setInventoryTestActor("Accountant");
    server.use(inventoryPermissions([INVENTORY_PERMISSIONS.stockUpdate], ["ACCOUNTANT"]));
    renderInventory(<AdjustmentCreate />);
    expect(
      await screen.findByRole("button", { name: INVENTORY_LABELS.submitAdjustment }),
    ).toBeInTheDocument();
  });
});
