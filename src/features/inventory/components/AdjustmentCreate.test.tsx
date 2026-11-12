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
  STOCK_ADJUSTMENT_DIRECTION_LABELS,
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

async function pickDirection(label: string) {
  await userEvent.click(screen.getByRole("combobox", { name: /Chiều điều chỉnh/ }));
  await userEvent.click(await screen.findByRole("option", { name: label }));
}

const LPN = "LPN-20261110-000001";
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
  await userEvent.type(await screen.findByLabelText(/LPN thùng/), LPN);
  await pickDirection(STOCK_ADJUSTMENT_DIRECTION_LABELS.WRITE_OFF);
}

describe("adjustment create form (one whole carton, docs 20 §4.3)", () => {
  it("requires a direction and a reason before submitting", async () => {
    renderInventory(<AdjustmentCreate />);
    await userEvent.type(await screen.findByLabelText(/LPN thùng/), LPN);
    expect(screen.getByRole("button", { name: INVENTORY_LABELS.submitAdjustment })).toBeDisabled();
    await pickDirection(STOCK_ADJUSTMENT_DIRECTION_LABELS.WRITE_OFF);
    expect(screen.getByRole("button", { name: INVENTORY_LABELS.submitAdjustment })).toBeDisabled();
    await pickReason(STOCK_ADJUSTMENT_REASON_LABELS.DAMAGED);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: INVENTORY_LABELS.submitAdjustment })).toBeEnabled(),
    );
  });

  it("has no quantity field: a carton is adjusted whole", async () => {
    renderInventory(<AdjustmentCreate />);
    await screen.findByLabelText(/LPN thùng/);
    expect(screen.queryByLabelText(/Chênh lệch/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/SKU/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Vị trí/)).not.toBeInTheDocument();
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
    await pickReason(STOCK_ADJUSTMENT_REASON_LABELS.DAMAGED);
    await userEvent.click(screen.getByRole("button", { name: INVENTORY_LABELS.submitAdjustment }));
    await waitFor(() =>
      expect(navigation.push).toHaveBeenCalledWith(
        INVENTORY_ROUTES.adjustment(fixture.adjustmentId),
      ),
    );
    expect(submitted).toHaveBeenCalledWith({
      lpn: LPN,
      direction: "WRITE_OFF",
      reason: "DAMAGED",
    });
  });

  it("upper-cases a scanned LPN before sending", async () => {
    const submitted = vi.fn();
    server.use(
      http.post(endpoint, async ({ request }) => {
        submitted(await request.json());
        return HttpResponse.json({ success: true, data: adjustmentFixture() }, { status: 201 });
      }),
    );
    renderInventory(<AdjustmentCreate />);
    await userEvent.type(await screen.findByLabelText(/LPN thùng/), LPN.toLowerCase());
    await pickDirection(STOCK_ADJUSTMENT_DIRECTION_LABELS.RESTOCK);
    await pickReason(STOCK_ADJUSTMENT_REASON_LABELS.FOUND);
    await userEvent.click(screen.getByRole("button", { name: INVENTORY_LABELS.submitAdjustment }));
    await waitFor(() => expect(submitted).toHaveBeenCalled());
    expect(submitted.mock.lastCall?.[0]).toMatchObject({
      lpn: LPN,
      direction: "RESTOCK",
      reason: "FOUND",
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
            message: "Unknown carton",
            fieldErrors: [{ field: "lpn", message: "Unknown LPN" }],
            correlationId: "create-test",
          },
          { status: 422 },
        ),
      ),
    );
    renderInventory(<AdjustmentCreate />);
    await enterAdjustment();
    await pickReason(STOCK_ADJUSTMENT_REASON_LABELS.DAMAGED);
    await userEvent.click(screen.getByRole("button", { name: INVENTORY_LABELS.submitAdjustment }));
    expect(await screen.findByText("Unknown LPN")).toBeInTheDocument();
    expect(screen.getByLabelText(/LPN thùng/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/create-test/)).toBeInTheDocument();
    expect(screen.getByText(INVENTORY_ERROR_MESSAGES.validation)).toBeInTheDocument();
    expect(screen.queryByText("Unknown carton")).not.toBeInTheDocument();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it.each([
    ["STOCK_PACKAGE_NOT_FOUND", 404, INVENTORY_ERROR_MESSAGES.cartonNotFound],
    ["STOCK_PACKAGE_HELD", 409, INVENTORY_ERROR_MESSAGES.cartonHeld],
    ["STOCK_PACKAGE_ADJUSTMENT_PENDING", 409, INVENTORY_ERROR_MESSAGES.cartonAdjustmentPending],
    ["INVALID_STOCK_PACKAGE_TRANSITION", 409, INVENTORY_ERROR_MESSAGES.cartonTransition],
    ["STOCK_SLOT_UNDER_COUNT", 409, INVENTORY_ERROR_MESSAGES.cartonUnderCount],
  ])(
    "says what is wrong with the carton for %s, never the backend text",
    async (code, status, text) => {
      server.use(
        http.post(endpoint, () =>
          HttpResponse.json(
            { success: false, errorCode: code, message: "English backend prose" },
            { status },
          ),
        ),
      );
      renderInventory(<AdjustmentCreate />);
      await enterAdjustment();
      await pickReason(STOCK_ADJUSTMENT_REASON_LABELS.DAMAGED);
      await userEvent.click(
        screen.getByRole("button", { name: INVENTORY_LABELS.submitAdjustment }),
      );
      expect(await screen.findByText(text)).toBeInTheDocument();
      expect(screen.queryByText(/English backend prose/)).not.toBeInTheDocument();
      expect(navigation.push).not.toHaveBeenCalled();
    },
  );

  it("offers only the five reasons a person may choose", async () => {
    renderInventory(<AdjustmentCreate />);
    await userEvent.click(await screen.findByRole("combobox", { name: /Lý do điều chỉnh/ }));
    const options = (await screen.findAllByRole("option")).map((option) => option.textContent);
    expect(options).toEqual([
      STOCK_ADJUSTMENT_REASON_LABELS.DAMAGED,
      STOCK_ADJUSTMENT_REASON_LABELS.LOST,
      STOCK_ADJUSTMENT_REASON_LABELS.FOUND,
      STOCK_ADJUSTMENT_REASON_LABELS.DATA_CORRECTION,
      STOCK_ADJUSTMENT_REASON_LABELS.OTHER,
    ]);
    expect(screen.queryByRole("option", { name: /Chênh lệch kiểm kê/ })).not.toBeInTheDocument();
  });

  it("fills the form from the quarantine screen's write-off link", async () => {
    renderInventory(<AdjustmentCreate />, `?lpn=${LPN}&direction=WRITE_OFF&reason=DAMAGED`);
    expect(await screen.findByLabelText(/LPN thùng/)).toHaveValue(LPN);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: INVENTORY_LABELS.submitAdjustment })).toBeEnabled(),
    );
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
    await pickReason(STOCK_ADJUSTMENT_REASON_LABELS.DAMAGED);
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
    await pickReason(STOCK_ADJUSTMENT_REASON_LABELS.DAMAGED);
    await userEvent.click(screen.getByRole("button", { name: INVENTORY_LABELS.submitAdjustment }));
    expect(await screen.findByText(INVENTORY_ERROR_MESSAGES.server)).toBeInTheDocument();
    // The user corrects the form (a server error keeps submit disabled until an edit).
    const lpn = screen.getByLabelText(/LPN thùng/);
    await userEvent.clear(lpn);
    await userEvent.type(lpn, "LPN-20261110-000002");
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
    expect(await screen.findByRole("option", { name: "Thùng hỏng" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "DAMAGED" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("option", { name: "Thùng hỏng" }));
    await userEvent.click(screen.getByRole("button", { name: INVENTORY_LABELS.submitAdjustment }));
    await waitFor(() => expect(submitted).toHaveBeenCalled());
    expect(submitted.mock.lastCall?.[0]).toMatchObject({ reason: "DAMAGED" });
  });

  it("explains that a carton is adjusted whole", async () => {
    renderInventory(<AdjustmentCreate />);
    const lpn = await screen.findByLabelText(/LPN thùng/);
    const help = screen.getByText(INVENTORY_LABELS.lpnHelp);
    expect(help.id).toBeTruthy();
    expect(lpn.getAttribute("aria-describedby")?.split(" ")).toContain(help.id);
  });
});
