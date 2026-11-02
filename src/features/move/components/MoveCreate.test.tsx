import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { INVENTORY_LABELS } from "@/constants/inventory";
import { MOVE_API, MOVE_ERROR_MESSAGES, MOVE_LABELS, MOVE_MESSAGES } from "@/constants/move";
import { INVENTORY_PERMISSIONS, WAREHOUSE_LOCATION_PERMISSIONS } from "@/constants/permissions";

import {
  failure,
  moveEndpoint,
  movePermissions,
  renderMove,
  setMoveTestActor,
} from "../test-support";
import { MoveCreate } from "./MoveCreate";

const server = setupServer();
const moveUrl = moveEndpoint(MOVE_API.move);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const stockUpdate = INVENTORY_PERMISSIONS.stockUpdate;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  localStorage.clear();
  setMoveTestActor();
  server.use(movePermissions([stockUpdate]));
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

function created(body: Record<string, unknown>) {
  return HttpResponse.json(
    {
      success: true,
      data: {
        movementId: crypto.randomUUID(),
        sku: body.sku,
        fromLocation: body.fromLocation,
        toLocation: body.toLocation,
        quantity: body.quantity,
        occurredAt: "2026-10-19T03:00:00Z",
      },
    },
    { status: 201 },
  );
}

async function fill(quantity = "5", to = "HCM-PACK01") {
  await userEvent.type(await screen.findByLabelText(/^SKU/), "CUP-PP-500");
  await userEvent.type(screen.getByLabelText(/Từ vị trí/), "HCM-A01-1-A");
  await userEvent.type(screen.getByLabelText(/Đến vị trí/), to);
  const qty = screen.getByLabelText(/Số lượng/);
  await userEvent.clear(qty);
  await userEvent.type(qty, quantity);
}

const submit = () => screen.getByRole("button", { name: MOVE_LABELS.submit });

describe("move form — permission gate", () => {
  it("is denied without the BE guard permission (inventory-stock-items:UPDATE) and sends nothing", async () => {
    server.use(movePermissions([INVENTORY_PERMISSIONS.movementRead]));
    renderMove(<MoveCreate />);
    expect(await screen.findByText(MOVE_LABELS.denied)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^SKU/)).not.toBeInTheDocument();
  });
});

describe("move form — submit", () => {
  it("sends the BE contract with an idempotency key and shows what was moved", async () => {
    const sent = vi.fn();
    server.use(
      http.post(moveUrl, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        sent(body);
        return created(body);
      }),
    );
    renderMove(<MoveCreate />);
    await fill();
    await waitFor(() => expect(submit()).toBeEnabled());
    await userEvent.click(submit());
    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent(MOVE_LABELS.resultTitle);
    expect(status).toHaveTextContent("HCM-PACK01");
    expect(sent).toHaveBeenCalledTimes(1);
    const body = sent.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body).toEqual({
      requestId: expect.stringMatching(UUID),
      sku: "CUP-PP-500",
      fromLocation: "HCM-A01-1-A",
      toLocation: "HCM-PACK01",
      quantity: 5,
    });
    expect(body).not.toHaveProperty("lotNumber");
    // The form is ready for the next move.
    expect(screen.getByLabelText(/^SKU/)).toHaveValue("");
    expect(screen.getByLabelText(/Số lượng/)).toHaveValue(null);
  });

  it("keeps the submit disabled for an invalid move: same location, other warehouse, quantity 0", async () => {
    renderMove(<MoveCreate />);
    await fill("5", "hcm-a01-1-a");
    expect(await screen.findByText(MOVE_MESSAGES.sameLocation)).toBeInTheDocument();
    expect(submit()).toBeDisabled();

    await userEvent.clear(screen.getByLabelText(/Đến vị trí/));
    await userEvent.type(screen.getByLabelText(/Đến vị trí/), "HN-PACK01");
    expect(await screen.findByText(MOVE_MESSAGES.crossWarehouse)).toBeInTheDocument();
    expect(submit()).toBeDisabled();

    await userEvent.clear(screen.getByLabelText(/Đến vị trí/));
    await userEvent.type(screen.getByLabelText(/Đến vị trí/), "HCM-PACK01");
    await userEvent.clear(screen.getByLabelText(/Số lượng/));
    await userEvent.type(screen.getByLabelText(/Số lượng/), "0");
    expect(await screen.findByText(MOVE_MESSAGES.quantity)).toBeInTheDocument();
    expect(submit()).toBeDisabled();
  });

  it("includes the lot when one is entered", async () => {
    const sent = vi.fn();
    server.use(
      http.post(moveUrl, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        sent(body);
        return created(body);
      }),
    );
    renderMove(<MoveCreate />);
    await fill();
    await userEvent.type(screen.getByLabelText(/^Lô/), "LOT-7");
    await waitFor(() => expect(submit()).toBeEnabled());
    await userEvent.click(submit());
    await screen.findByRole("status");
    expect(sent.mock.calls[0]?.[0]).toMatchObject({ lotNumber: "LOT-7" });
  });
});

describe("move form — BE errors in Vietnamese", () => {
  it.each([
    ["INSUFFICIENT_STOCK", 409, MOVE_ERROR_MESSAGES.insufficientStock],
    ["STOCK_ITEM_NOT_FOUND", 404, MOVE_ERROR_MESSAGES.stockItemNotFound],
    ["LOCATION_NOT_FOUND", 404, MOVE_ERROR_MESSAGES.locationNotFound],
    ["LOCATION_NOT_USABLE", 409, MOVE_ERROR_MESSAGES.locationNotUsable],
    ["MOVE_ACROSS_WAREHOUSES", 409, MOVE_ERROR_MESSAGES.crossWarehouse],
    ["STOCK_SLOT_UNDER_COUNT", 409, MOVE_ERROR_MESSAGES.slotUnderCount],
    ["STOCK_STATUS_MISMATCH", 409, MOVE_ERROR_MESSAGES.statusMismatch],
    ["INVENTORY_POLICY_STOCK_CONFLICT", 409, MOVE_ERROR_MESSAGES.policyConflict],
    ["OUT_OF_DATA_SCOPE", 403, MOVE_ERROR_MESSAGES.outOfScope],
  ])("%s", async (code, status, message) => {
    server.use(http.post(moveUrl, () => failure(status, code)));
    renderMove(<MoveCreate />);
    await fill();
    await waitFor(() => expect(submit()).toBeEnabled());
    await userEvent.click(submit());
    const alert = await screen.findByText(message);
    expect(alert).toBeInTheDocument();
    expect(screen.queryByText(/English server message/)).not.toBeInTheDocument();
    // The typed values survive a refused move.
    expect(screen.getByLabelText(/^SKU/)).toHaveValue("CUP-PP-500");
  });

  it("puts a server field error under its field, in Vietnamese", async () => {
    server.use(
      http.post(moveUrl, () =>
        failure(400, "VALIDATION_FAILED", [
          { field: "quantity", message: "quantity must be at least 1", code: "Min" },
        ]),
      ),
    );
    renderMove(<MoveCreate />);
    await fill();
    await waitFor(() => expect(submit()).toBeEnabled());
    await userEvent.click(submit());
    expect(await screen.findAllByText(MOVE_MESSAGES.quantity)).not.toHaveLength(0);
  });
});

describe("move form — idempotency key", () => {
  it("retries the same content under the same requestId, and a changed move under a new one", async () => {
    const ids: string[] = [];
    let attempt = 0;
    server.use(
      http.post(moveUrl, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        ids.push(String(body.requestId));
        attempt += 1;
        return attempt < 3 ? failure(500, "INTERNAL_ERROR") : created(body);
      }),
    );
    renderMove(<MoveCreate />);
    await fill();
    await waitFor(() => expect(submit()).toBeEnabled());
    await userEvent.click(submit());
    await screen.findByText(MOVE_ERROR_MESSAGES.server);
    await userEvent.click(submit());
    await waitFor(() => expect(ids).toHaveLength(2));
    expect(ids[1]).toBe(ids[0]);

    await screen.findByText(MOVE_ERROR_MESSAGES.server);
    const qty = screen.getByLabelText(/Số lượng/);
    await userEvent.clear(qty);
    await userEvent.type(qty, "6");
    await userEvent.click(submit());
    await waitFor(() => expect(ids).toHaveLength(3));
    expect(ids[2]).not.toBe(ids[0]);
  });
});

describe("move form — stock aids (optional, separately permissioned)", () => {
  const row = {
    id: crypto.randomUUID(),
    sku: "CUP-PP-500",
    locationCode: "HCM-A01-1-A",
    lotNumber: "LOT-7",
    onHand: 10,
    reserved: 4,
    available: 6,
    status: "AVAILABLE",
  };

  it("lists the SKU's stock and fills source + lot from the chosen row; warns above the movable quantity", async () => {
    server.use(
      movePermissions([stockUpdate, INVENTORY_PERMISSIONS.stockRead]),
      http.get(moveEndpoint(MOVE_API.stockItems), ({ request }) => {
        expect(new URL(request.url).searchParams.get("sku")).toBe("CUP-PP-500");
        return HttpResponse.json({ success: true, data: [row] });
      }),
    );
    renderMove(<MoveCreate />);
    await userEvent.type(await screen.findByLabelText(/^SKU/), "CUP-PP-500");
    const section = await screen.findByRole("region", { name: MOVE_LABELS.stockTitle });
    await userEvent.click(within(section).getByRole("button", { name: MOVE_LABELS.stockPick }));
    expect(screen.getByLabelText(/Từ vị trí/)).toHaveValue("HCM-A01-1-A");
    expect(screen.getByLabelText(/^Lô/)).toHaveValue("LOT-7");
    expect(screen.getByText(new RegExp(`${MOVE_LABELS.movableUpTo}: 6`))).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Số lượng/), "7");
    expect(await screen.findByText(MOVE_MESSAGES.exceedsMovable)).toBeInTheDocument();
  });

  it("without stock READ it makes no stock request and the form still works by typing", async () => {
    renderMove(<MoveCreate />);
    await fill();
    expect(screen.queryByRole("region", { name: MOVE_LABELS.stockTitle })).not.toBeInTheDocument();
    await waitFor(() => expect(submit()).toBeEnabled());
  });

  it("suggests usable locations of the source's warehouse from the layout", async () => {
    server.use(
      movePermissions([stockUpdate, WAREHOUSE_LOCATION_PERMISSIONS.read]),
      http.get(moveEndpoint("/warehouses"), () =>
        HttpResponse.json({
          success: true,
          data: {
            items: [{ id: "11111111-1111-4111-8111-111111111111", prefix: "HCM", name: "Kho HCM" }],
          },
        }),
      ),
      http.get(moveEndpoint("/warehouses/11111111-1111-4111-8111-111111111111/layout"), () =>
        HttpResponse.json({
          success: true,
          data: {
            shelves: [
              {
                levels: [
                  {
                    bins: [
                      { locationCode: "HCM-A01-1-B", usable: true },
                      { locationCode: "HCM-A01-1-C", usable: false },
                    ],
                  },
                ],
              },
            ],
            areas: [{ locationCode: "HCM-PACK01", usable: true }],
          },
        }),
      ),
    );
    renderMove(<MoveCreate />);
    await userEvent.type(await screen.findByLabelText(/Từ vị trí/), "HCM-A01-1-A");
    await waitFor(() =>
      expect(document.querySelectorAll("#move-toLocation-options option")).toHaveLength(2),
    );
    const values = [
      ...document.querySelectorAll<HTMLOptionElement>("#move-toLocation-options option"),
    ];
    expect(values.map((option) => option.value)).toEqual(["HCM-A01-1-B", "HCM-PACK01"]);
  });
});

describe("move form — source slot under a cycle count (SCRUM-146)", () => {
  it("warns and keeps submit disabled when the typed source is hidden during a count", async () => {
    const sent = vi.fn();
    server.use(
      movePermissions([stockUpdate, INVENTORY_PERMISSIONS.stockRead]),
      http.get(moveEndpoint(MOVE_API.stockItems), () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              id: crypto.randomUUID(),
              sku: "CUP-PP-500",
              locationCode: "HCM-A01-1-A",
              status: "AVAILABLE",
              hiddenDuringCount: true,
            },
          ],
        }),
      ),
      http.post(moveUrl, async ({ request }) => {
        sent(await request.json());
        return failure(500, "UNEXPECTED");
      }),
    );
    renderMove(<MoveCreate />);
    await fill();
    expect(await screen.findByText(MOVE_MESSAGES.sourceUnderCount)).toBeInTheDocument();
    expect(await screen.findByText(INVENTORY_LABELS.hiddenDuringCount)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: MOVE_LABELS.stockPicked })).toBeDisabled();
    expect(submit()).toBeDisabled();
    expect(sent).not.toHaveBeenCalled();
  });
});
