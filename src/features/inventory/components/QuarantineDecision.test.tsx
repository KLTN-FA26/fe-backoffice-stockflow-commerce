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
  QUARANTINE_LIST_LABELS as LL,
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
    countedAt: "2026-11-10T02:00:00Z",
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
    // Không có khu mặc định (thiếu warehouse-locations:READ / chưa chọn kho) → nhắc nhập mã khu, chưa gọi danh sách
    expect(await screen.findByText(LL.prompt)).toBeInTheDocument();
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

  it("WF-05 TH-4: a returned carton that came back opened is refused release — written off only, in Vietnamese", async () => {
    server.use(
      inventoryPermissions(MANAGER),
      http.get(cartonEndpoint, () => ok(cartonBody("QUARANTINE"))),
      http.post(inventoryEndpoint(QUARANTINE_API.release(LPN)), () =>
        fail("RETURN_CARTON_OPENED", 409),
      ),
    );
    renderInventory(<QuarantineDecision />, `?lpn=${LPN}`);
    await userEvent.click(await screen.findByRole("button", { name: L.release }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: L.release }));
    expect(
      await within(dialog).findByText(QUARANTINE_ERROR_MESSAGES.returnCartonOpened),
    ).toBeInTheDocument();
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

  it("WF-05 BE-24: a carton flagged opened on return offers only the write-off, never the release", async () => {
    server.use(
      inventoryPermissions(MANAGER),
      http.get(cartonEndpoint, () =>
        ok(
          cartonBody("QUARANTINE", {
            openedOnReturn: true,
            returnOpenedAt: "2026-11-24T03:00:00Z",
          }),
        ),
      ),
    );
    renderInventory(<QuarantineDecision />, `?lpn=${LPN}`);
    expect(await screen.findByRole("link", { name: L.writeOff })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.release })).toBeNull();
    expect(screen.getByText(L.openedOnReturnNotice)).toBeInTheDocument();
    expect(screen.getByText(L.openedOnReturn)).toBeInTheDocument();
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

describe("cartons in a quarantine area (BE GET /inventory/stock-packages?location=)", () => {
  const listEndpoint = inventoryEndpoint(QUARANTINE_API.list);
  const row = (lpn: string, extra: Record<string, unknown> = {}) => ({
    lpn,
    sku: "CUP-PP-500",
    nominalQty: 120,
    countedAt: "2026-11-10T02:00:00Z",
    lotNumber: "PO-1001",
    onHand: 120,
    reserved: 0,
    status: "IN_STOCK",
    locationCode: "HCM-QC01",
    ...extra,
  });
  const page = (items: unknown[], over: Record<string, unknown> = {}) => ({
    items,
    page: 0,
    size: 15,
    totalElements: items.length,
    totalPages: 1,
    hasNext: false,
    hasPrevious: false,
    ...over,
  });

  it("lists the area typed (upper-cased, exact) with SKU filter in the URL; a row opens that carton", async () => {
    const seen: URLSearchParams[] = [];
    server.use(
      inventoryPermissions(MANAGER),
      http.get(listEndpoint, ({ request }) => {
        seen.push(new URL(request.url).searchParams);
        return ok(page([row(LPN), row("LPN-20261110-000009", { status: "VOID", onHand: 0 })]));
      }),
      http.get(cartonEndpoint, () => ok(cartonBody("QUARANTINE"))),
    );
    renderInventory(<QuarantineDecision />);
    await userEvent.type(await screen.findByLabelText(LL.location), "hcm-qc01");
    await userEvent.type(screen.getByLabelText(LL.sku), "cup-pp-500");
    await userEvent.click(screen.getByRole("button", { name: LL.apply }));
    const table = await screen.findByRole("region", { name: LL.title });
    expect(await within(table).findByRole("button", { name: LPN })).toBeInTheDocument();
    expect(seen.at(-1)?.get("location")).toBe("HCM-QC01");
    expect(seen.at(-1)?.get("sku")).toBe("CUP-PP-500");
    expect(seen.at(-1)?.get("page")).toBe("0");
    // VOID không có nhãn → nguyên văn, không làm hỏng bảng
    expect(within(table).getByText("VOID")).toBeInTheDocument();
    await userEvent.click(within(table).getByRole("button", { name: LPN }));
    expect(await screen.findByRole("button", { name: L.release })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: L.backToList }));
    expect(await screen.findByRole("region", { name: LL.title })).toBeInTheDocument();
  });

  it("opens straight on the area in the URL; an empty area says so, distinct from a SKU that matches nothing", async () => {
    server.use(
      inventoryPermissions(MANAGER),
      http.get(listEndpoint, () => ok(page([]))),
    );
    renderInventory(<QuarantineDecision />, "?location=HCM-QC01");
    expect(await screen.findByText(LL.empty)).toBeInTheDocument();
    cleanup();
    renderInventory(<QuarantineDecision />, "?location=HCM-QC01&sku=NOPE");
    expect(await screen.findByText(LL.noMatch)).toBeInTheDocument();
  });

  it("says why the list failed without the backend text", async () => {
    server.use(
      inventoryPermissions(MANAGER),
      http.get(listEndpoint, () => fail("FORBIDDEN", 403)),
    );
    renderInventory(<QuarantineDecision />, "?location=HN-QC01");
    expect(await screen.findByText(INVENTORY_LABELS.denied)).toBeInTheDocument();
    expect(screen.queryByText(/English backend prose/)).not.toBeInTheDocument();
  });
});

// Audit r3 RAD-4 (BE r3c): a sealed RMA carton confirmed into quarantine stays PENDING until the accountant decides the
// refund. Before, the screen offered "Gỡ cách ly" / "Ghi giảm", the BE answered 409 STOCK_PACKAGE_DECISION_PENDING and the
// screen blamed "another decision" instead of the refund.
describe("audit r3 RAD-4: a carton waiting for its return's refund decision", () => {
  const RET = "0193a1b2-0000-7000-8000-0000000000aa";
  const pending = {
    returnOwnership: "PENDING",
    returnRequestId: RET,
    returnRmaNumber: "RMA-20261120-0003",
  };

  it("offers neither release nor write-off, and names the return it waits for", async () => {
    server.use(
      inventoryPermissions(MANAGER),
      http.get(cartonEndpoint, () => ok(cartonBody("QUARANTINE", pending))),
    );
    renderInventory(<QuarantineDecision />, `?lpn=${LPN}`);
    expect(await screen.findByText(L.refundPending("RMA-20261120-0003"))).toBeInTheDocument();
    expect(L.refundPending("RMA-20261120-0003")).toBe("Chờ duyệt hoàn tiền — RMA-20261120-0003");
    expect(screen.getByText(L.refundPendingNotice)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.release })).toBeNull();
    expect(screen.queryByRole("link", { name: L.writeOff })).toBeNull();
  });

  it("a carton that is the customer's (held for them) is not decidable either", async () => {
    server.use(
      inventoryPermissions(MANAGER),
      http.get(cartonEndpoint, () =>
        ok(cartonBody("QUARANTINE", { ...pending, returnOwnership: "CUSTOMER_HELD" })),
      ),
    );
    renderInventory(<QuarantineDecision />, `?lpn=${LPN}`);
    expect(await screen.findByText(L.customerOwnedNotice)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.release })).toBeNull();
    expect(screen.queryByRole("link", { name: L.writeOff })).toBeNull();
  });

  it("COMPANY decides like any quarantined carton", async () => {
    server.use(
      inventoryPermissions(MANAGER),
      http.get(cartonEndpoint, () =>
        ok(cartonBody("QUARANTINE", { ...pending, returnOwnership: "COMPANY" })),
      ),
    );
    renderInventory(<QuarantineDecision />, `?lpn=${LPN}`);
    expect(await screen.findByRole("button", { name: L.release })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: L.writeOff })).toBeInTheDocument();
  });

  it("the 409 with details.returnOwnership says the refund is awaited, naming the RMA of the carton just read", async () => {
    server.use(
      inventoryPermissions(MANAGER),
      // Read before the return came back on it (or from an older read): the screen still offers the release
      http.get(cartonEndpoint, () =>
        ok(
          cartonBody("QUARANTINE", { returnRequestId: RET, returnRmaNumber: "RMA-20261120-0003" }),
        ),
      ),
      http.post(inventoryEndpoint(QUARANTINE_API.release(LPN)), () =>
        HttpResponse.json(
          {
            success: false,
            errorCode: "STOCK_PACKAGE_DECISION_PENDING",
            message: "English backend prose",
            details: { lpn: LPN, returnOwnership: "PENDING", returnRequestId: RET },
          },
          { status: 409 },
        ),
      ),
    );
    renderInventory(<QuarantineDecision />, `?lpn=${LPN}`);
    await userEvent.click(await screen.findByRole("button", { name: L.release }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: L.release }));
    expect(
      await within(dialog).findByText(
        QUARANTINE_ERROR_MESSAGES.refundDecisionPending("RMA-20261120-0003"),
      ),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText(QUARANTINE_ERROR_MESSAGES.decisionPending)).toBeNull();
  });

  it("without details.returnOwnership the old wording stays (a putaway task or a write-off under way)", async () => {
    server.use(
      inventoryPermissions(MANAGER),
      http.get(cartonEndpoint, () => ok(cartonBody("QUARANTINE"))),
      http.post(inventoryEndpoint(QUARANTINE_API.release(LPN)), () =>
        fail("STOCK_PACKAGE_DECISION_PENDING", 409),
      ),
    );
    renderInventory(<QuarantineDecision />, `?lpn=${LPN}`);
    await userEvent.click(await screen.findByRole("button", { name: L.release }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: L.release }));
    expect(
      await within(dialog).findByText(QUARANTINE_ERROR_MESSAGES.decisionPending),
    ).toBeInTheDocument();
  });
});
