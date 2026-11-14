import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { INVENTORY_LABELS, INVENTORY_ROUTES } from "@/constants/inventory";
import { INVENTORY_PERMISSIONS, STOCK_PACKAGE_PERMISSIONS } from "@/constants/permissions";
import {
  QUARANTINE_API,
  QUARANTINE_ERROR_MESSAGES,
  QUARANTINE_LABELS as L,
} from "@/constants/quarantine";

import {
  inventoryEndpoint,
  inventoryPermissions,
  renderInventory,
  setInventoryTestActor,
} from "../test-support";
import { QuarantineDecision } from "./QuarantineDecision";

const server = setupServer();
const SP = STOCK_PACKAGE_PERMISSIONS;
const LPN = "LPN-20261110-000001";
const MANAGER = [SP.viewPage, SP.read, SP.create, SP.update, INVENTORY_PERMISSIONS.stockUpdate];
const STAFF = [SP.viewPage, SP.read, SP.create, INVENTORY_PERMISSIONS.stockUpdate];
const cartonEndpoint = inventoryEndpoint(QUARANTINE_API.carton(LPN));

const ok = (data: unknown) => HttpResponse.json({ success: true, data });
const fail = (errorCode: string, status: number) =>
  HttpResponse.json({ success: false, errorCode, message: "English backend prose" }, { status });

function cartonBody(stockStatus: string, extra: Record<string, unknown> = {}) {
  return {
    lpn: LPN,
    sku: "CUP-PP-500",
    nominalQty: 120,
    receivedQty: 120,
    lotNumber: "PO-1001",
    onHand: 120,
    reserved: 0,
    status: "IN_STOCK",
    locationCode: stockStatus === "QUARANTINE" ? "HCM-QC01" : "HCM-A01-1-B",
    contents: [{ lotNumber: "PO-1001", status: stockStatus, onHand: 120, reserved: 0 }],
    ...extra,
  };
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => undefined;
  Element.prototype.scrollIntoView ??= () => undefined;
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
});

describe("quarantine decisions on one carton (docs 20 §4.8)", () => {
  it("asks for an LPN first, then shows the carton's place, lot and stock status", async () => {
    server.use(
      inventoryPermissions(MANAGER),
      http.get(cartonEndpoint, () => ok(cartonBody("AVAILABLE"))),
    );
    renderInventory(<QuarantineDecision />);
    expect(await screen.findByText(L.prompt)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(L.lookupLabel), `${LPN.toLowerCase()}{Enter}`);
    expect(await screen.findByText("HCM-A01-1-B")).toBeInTheDocument();
    expect(screen.getByText("PO-1001")).toBeInTheDocument();
    expect(screen.getByText(L.notQuarantined)).toBeInTheDocument();
    expect(screen.getByText("Trong kho")).toBeInTheDocument();
  });

  it("quarantines a free carton whole: location and reason are sent, nothing else", async () => {
    let body: unknown;
    let quarantined = false;
    server.use(
      inventoryPermissions(MANAGER),
      http.get(cartonEndpoint, () => ok(cartonBody(quarantined ? "QUARANTINE" : "AVAILABLE"))),
      http.post(inventoryEndpoint(QUARANTINE_API.quarantine(LPN)), async ({ request }) => {
        body = await request.json();
        quarantined = true;
        return ok(cartonBody("QUARANTINE"));
      }),
    );
    renderInventory(<QuarantineDecision />, `?lpn=${LPN}`);
    await userEvent.click(await screen.findByRole("button", { name: L.quarantine }));
    const dialog = screen.getByRole("dialog");
    // The reason is required before anything is sent.
    expect(within(dialog).getByRole("button", { name: L.quarantine })).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText(/Lý do cách ly/), "Thùng móp một bên");
    await userEvent.type(within(dialog).getByLabelText(/Vị trí khu cách ly/), "hcm-qc01");
    await userEvent.click(within(dialog).getByRole("button", { name: L.quarantine }));
    await waitFor(() =>
      expect(body).toEqual({ locationCode: "HCM-QC01", reason: "Thùng móp một bên" }),
    );
    // The carton is read again: it now shows as quarantined and offers release and write-off.
    expect(await screen.findByText(L.quarantined)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: L.release })).toBeInTheDocument();
  });

  it("needs a location before it asks the backend", async () => {
    let calls = 0;
    server.use(
      inventoryPermissions(MANAGER),
      http.get(cartonEndpoint, () => ok(cartonBody("AVAILABLE"))),
      http.post(inventoryEndpoint(QUARANTINE_API.quarantine(LPN)), () => {
        calls += 1;
        return ok(cartonBody("QUARANTINE"));
      }),
    );
    renderInventory(<QuarantineDecision />, `?lpn=${LPN}`);
    await userEvent.click(await screen.findByRole("button", { name: L.quarantine }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/Lý do cách ly/), "Móp");
    await userEvent.click(within(dialog).getByRole("button", { name: L.quarantine }));
    expect(await within(dialog).findByText(/Trường bắt buộc/)).toBeInTheDocument();
    expect(calls).toBe(0);
  });

  it.each([
    ["LOCATION_AREA_MISMATCH", 409, QUARANTINE_ERROR_MESSAGES.notQuarantineArea],
    ["STOCK_PACKAGE_HELD", 409, QUARANTINE_ERROR_MESSAGES.held],
    ["STOCK_SLOT_UNDER_COUNT", 409, QUARANTINE_ERROR_MESSAGES.underCount],
    ["MOVE_ACROSS_WAREHOUSES", 409, QUARANTINE_ERROR_MESSAGES.acrossWarehouses],
  ])("explains %s in Vietnamese, never the backend text", async (code, status, text) => {
    server.use(
      inventoryPermissions(MANAGER),
      http.get(cartonEndpoint, () => ok(cartonBody("AVAILABLE"))),
      http.post(inventoryEndpoint(QUARANTINE_API.quarantine(LPN)), () => fail(code, status)),
    );
    renderInventory(<QuarantineDecision />, `?lpn=${LPN}`);
    await userEvent.click(await screen.findByRole("button", { name: L.quarantine }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/Lý do cách ly/), "Móp");
    await userEvent.type(within(dialog).getByLabelText(/Vị trí khu cách ly/), "HCM-A01-1-B");
    await userEvent.click(within(dialog).getByRole("button", { name: L.quarantine }));
    expect(await within(dialog).findByText(text)).toBeInTheDocument();
    expect(screen.queryByText(/English backend prose/)).not.toBeInTheDocument();
  });

  it("releases a quarantined carton to a putaway task, and says it stays quarantined until put away", async () => {
    let releases = 0;
    server.use(
      inventoryPermissions(MANAGER),
      http.get(cartonEndpoint, () => ok(cartonBody("QUARANTINE"))),
      http.post(inventoryEndpoint(QUARANTINE_API.release(LPN)), () => {
        releases += 1;
        return ok({
          id: crypto.randomUUID(),
          lpn: LPN,
          status: "OPEN",
          sourceLocationCode: "HCM-QC01",
        });
      }),
    );
    renderInventory(<QuarantineDecision />, `?lpn=${LPN}`);
    await userEvent.click(await screen.findByRole("button", { name: L.release }));
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText(/vẫn ở trạng thái cách ly tới khi cất xong/),
    ).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: L.release }));
    expect(await screen.findByText(L.released)).toBeInTheDocument();
    expect(releases).toBe(1);
  });

  it("writes a damaged quarantined carton off through the four-eyes adjustment, not directly", async () => {
    server.use(
      inventoryPermissions(MANAGER),
      http.get(cartonEndpoint, () => ok(cartonBody("QUARANTINE"))),
    );
    renderInventory(<QuarantineDecision />, `?lpn=${LPN}`);
    const link = await screen.findByRole("link", { name: L.writeOff });
    expect(link).toHaveAttribute(
      "href",
      `${INVENTORY_ROUTES.createAdjustment}?lpn=${LPN}&direction=WRITE_OFF&reason=DAMAGED`,
    );
  });

  it("warns that a carton held for an order must be released from the order first, and offers no quarantine", async () => {
    server.use(
      inventoryPermissions(MANAGER),
      http.get(cartonEndpoint, () => ok(cartonBody("AVAILABLE", { reserved: 120 }))),
    );
    renderInventory(<QuarantineDecision />, `?lpn=${LPN}`);
    expect(await screen.findByText(L.heldForOrder)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.quarantine })).not.toBeInTheDocument();
  });

  it("warehouse staff can look a carton up but not quarantine or release it", async () => {
    setInventoryTestActor("Warehouse Staff");
    server.use(
      inventoryPermissions(STAFF),
      http.get(cartonEndpoint, () => ok(cartonBody("QUARANTINE"))),
    );
    renderInventory(<QuarantineDecision />, `?lpn=${LPN}`);
    expect(await screen.findByText("HCM-QC01")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.quarantine })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.release })).not.toBeInTheDocument();
  });

  it("a carton no longer in stock shows no action to anyone", async () => {
    server.use(
      inventoryPermissions(MANAGER),
      http.get(cartonEndpoint, () =>
        ok(cartonBody("AVAILABLE", { status: "CONSUMED", contents: [] })),
      ),
    );
    renderInventory(<QuarantineDecision />, `?lpn=${LPN}`);
    expect(await screen.findByText("Đã dùng hết")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.quarantine })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.release })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: L.writeOff })).not.toBeInTheDocument();
  });

  it("says a carton cannot be found without the backend text, and can retry", async () => {
    server.use(
      inventoryPermissions(MANAGER),
      http.get(cartonEndpoint, () => fail("STOCK_PACKAGE_NOT_FOUND", 404)),
    );
    renderInventory(<QuarantineDecision />, `?lpn=${LPN}`);
    expect(await screen.findByText(L.loadError)).toBeInTheDocument();
    expect(screen.getByText(QUARANTINE_ERROR_MESSAGES.cartonNotFound)).toBeInTheDocument();
    expect(screen.queryByText(/English backend prose/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: INVENTORY_LABELS.retry })).toBeInTheDocument();
  });

  it.each([
    ["VIEW_PAGE alone", [SP.viewPage]],
    ["READ alone", [SP.read]],
  ] as const)("is denied with %s and never asks for the carton", async (_, permissions) => {
    const fetched = vi.fn();
    server.use(
      inventoryPermissions([...permissions]),
      http.get(cartonEndpoint, () => {
        fetched();
        return ok(cartonBody("AVAILABLE"));
      }),
    );
    renderInventory(<QuarantineDecision />, `?lpn=${LPN}`);
    expect(await screen.findByText(INVENTORY_LABELS.denied)).toBeInTheDocument();
    expect(fetched).not.toHaveBeenCalled();
  });
});
