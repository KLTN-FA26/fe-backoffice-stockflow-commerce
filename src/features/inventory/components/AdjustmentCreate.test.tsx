import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  INVENTORY_API,
  INVENTORY_ERROR_MESSAGES,
  INVENTORY_LABELS,
  INVENTORY_ROUTES,
  STOCK_ADJUSTMENT_REASON_LABELS,
} from "@/constants/inventory";
import { INVENTORY_PERMISSIONS } from "@/constants/permissions";

import {
  adjustmentFixture,
  inventoryEndpoint,
  inventoryPermissions,
  renderInventory,
  setInventoryTestActor,
} from "../test-support";
import { AdjustmentCreate } from "./AdjustmentCreate";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
const server = setupServer();
const endpoint = inventoryEndpoint(INVENTORY_API.adjustments);
beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  // Radix Select dùng pointer capture / scrollIntoView — jsdom không có
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => undefined;
  Element.prototype.scrollIntoView ??= () => undefined;
});

/** Chọn lý do điều chỉnh qua shadcn Select theo nhãn tiếng Việt. */
async function pickReason(label: string) {
  await userEvent.click(screen.getByRole("combobox", { name: /Lý do điều chỉnh/ }));
  await userEvent.click(await screen.findByRole("option", { name: label }));
}
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
    await pickReason(STOCK_ADJUSTMENT_REASON_LABELS.SCRAP);
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
    await pickReason(STOCK_ADJUSTMENT_REASON_LABELS.SCRAP);
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
    await pickReason(STOCK_ADJUSTMENT_REASON_LABELS.OTHER);
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
    await pickReason(STOCK_ADJUSTMENT_REASON_LABELS.SCRAP);
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
    await pickReason(STOCK_ADJUSTMENT_REASON_LABELS.SCRAP);
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

  it("two submits in the same frame send exactly one POST", async () => {
    const fixture = adjustmentFixture();
    let posts = 0;
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post(endpoint, async () => {
        posts += 1;
        await held;
        return HttpResponse.json({ success: true, data: fixture }, { status: 201 });
      }),
    );
    renderInventory(<AdjustmentCreate />);
    await enterAdjustment();
    await pickReason(STOCK_ADJUSTMENT_REASON_LABELS.SCRAP);
    const submit = screen.getByRole("button", { name: INVENTORY_LABELS.submitAdjustment });
    await waitFor(() => expect(submit).toBeEnabled());
    const form = submit.closest("form");
    if (!form) throw new Error("create form not rendered");
    // No await between the two: React has not re-rendered isPending yet.
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(posts).toBe(1));
    release();
    await waitFor(() =>
      expect(navigation.push).toHaveBeenCalledWith(
        INVENTORY_ROUTES.adjustment(fixture.adjustmentId),
      ),
    );
    expect(posts).toBe(1);
    expect(navigation.push).toHaveBeenCalledTimes(1);
  });

  it("releases the submit guard after a failure so a retry is sent", async () => {
    const fixture = adjustmentFixture();
    let posts = 0;
    server.use(
      http.post(endpoint, () => {
        posts += 1;
        return posts === 1
          ? HttpResponse.json(
              { success: false, errorCode: "SERVER_ERROR", message: "Boom" },
              { status: 500 },
            )
          : HttpResponse.json({ success: true, data: fixture }, { status: 201 });
      }),
    );
    renderInventory(<AdjustmentCreate />);
    await enterAdjustment();
    await pickReason(STOCK_ADJUSTMENT_REASON_LABELS.SCRAP);
    await userEvent.click(screen.getByRole("button", { name: INVENTORY_LABELS.submitAdjustment }));
    expect(await screen.findByText(INVENTORY_ERROR_MESSAGES.server)).toBeInTheDocument();
    // The user corrects the form (a server error keeps submit disabled until an edit).
    const delta = screen.getByLabelText(/Chênh lệch số lượng/);
    await userEvent.clear(delta);
    await userEvent.type(delta, "-2");
    const submit = screen.getByRole("button", { name: INVENTORY_LABELS.submitAdjustment });
    await waitFor(() => expect(submit).toBeEnabled());
    await userEvent.click(submit);
    await waitFor(() =>
      expect(navigation.push).toHaveBeenCalledWith(
        INVENTORY_ROUTES.adjustment(fixture.adjustmentId),
      ),
    );
    expect(posts).toBe(2);
  });

  it("shows Vietnamese reason labels but sends the exact wire code", async () => {
    const fixture = adjustmentFixture({ reason: "DAMAGED" });
    const submitted = vi.fn();
    server.use(
      http.post(endpoint, async ({ request }) => {
        submitted(await request.json());
        return HttpResponse.json({ success: true, data: fixture }, { status: 201 });
      }),
    );
    renderInventory(<AdjustmentCreate />);
    await enterAdjustment();
    await userEvent.click(screen.getByRole("combobox", { name: /Lý do điều chỉnh/ }));
    expect(await screen.findByRole("option", { name: "Hư hỏng" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "DAMAGED" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("option", { name: "Hư hỏng" }));
    await userEvent.click(screen.getByRole("button", { name: INVENTORY_LABELS.submitAdjustment }));
    await waitFor(() => expect(submitted).toHaveBeenCalled());
    expect(submitted.mock.lastCall?.[0]).toMatchObject({ reason: "DAMAGED" });
  });

  it("explains that the delta is in the SKU base unit", async () => {
    renderInventory(<AdjustmentCreate />);
    const delta = await screen.findByLabelText(/Chênh lệch số lượng/);
    const help = screen.getByText(INVENTORY_LABELS.quantityDeltaHelp);
    expect(help.id).toBeTruthy();
    expect(delta.getAttribute("aria-describedby")?.split(" ")).toContain(help.id);
  });
});
