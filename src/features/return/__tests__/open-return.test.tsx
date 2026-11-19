import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiError, bePage } from "@/test/api-screen";

import { OrderReturnsCard } from "..";
import {
  SALES_GRANTS,
  mockReturnApi,
  renderReturnScreen,
  returnJson,
} from "../__fixtures__/screen";

import type { ComponentProps } from "react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-16T03:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Đơn giao hai lô: lô 1 (SKU-CUP-01 × 20), lô 2 (SKU-CUP-01 × 4, SKU-BAG-02 × 10); lô 3 còn đang giao. */
const card = (over: Partial<ComponentProps<typeof OrderReturnsCard>> = {}) => (
  <OrderReturnsCard
    orderId="ord-1"
    orderNumber="SO-1"
    status="Shipped"
    deliveredAt={null}
    lines={[
      { lineId: "ol-1", sku: "SKU-CUP-01", deliveredQuantity: 24, customPrinted: true },
      { lineId: "ol-2", sku: "SKU-BAG-02", deliveredQuantity: 10, customPrinted: false },
    ]}
    shipments={[
      {
        shipmentId: "s-1",
        deliveredAt: "2026-11-05T03:00:00Z",
        lines: [{ lineId: "ol-1", quantity: 20 }],
      },
      {
        shipmentId: "s-2",
        deliveredAt: "2026-11-14T03:00:00Z",
        lines: [
          { lineId: "ol-1", quantity: 4 },
          { lineId: "ol-2", quantity: 10 },
        ],
      },
    ]}
    returnWindowDays={null}
    {...over}
  />
);

async function openDialog() {
  await userEvent.click(await screen.findByRole("button", { name: /Mở yêu cầu trả hàng/ }));
  return screen.findByRole("dialog");
}

async function pickShipment(dialog: HTMLElement, label: RegExp) {
  await userEvent.click(within(dialog).getByLabelText(/Lô giao chứa hàng trả/));
  await userEvent.click(await screen.findByRole("option", { name: label }));
}

describe("Opening a return on an order delivered in several shipments (WF-05 TH-1)", () => {
  it("is offered while later shipments are still on their way, once one was delivered", async () => {
    mockReturnApi(SALES_GRANTS, { get: { "/returns": () => bePage([]) } });
    renderReturnScreen(card());
    expect(await screen.findByRole("button", { name: /Mở yêu cầu trả hàng/ })).toBeVisible();
  });

  it("is not offered in delivery with no shipment delivered yet", async () => {
    const list = vi.fn(() => bePage([]));
    mockReturnApi(SALES_GRANTS, { get: { "/returns": list } });
    const view = renderReturnScreen(card({ shipments: [] }));
    await waitFor(() => expect(list).toHaveBeenCalled());
    expect(view.container).toBeEmptyDOMElement();
  });

  it("asks for the shipment, limits lines to it and sends its shipmentId", async () => {
    const open = vi.fn((_body: unknown) => returnJson());
    mockReturnApi(SALES_GRANTS, {
      get: { "/returns": () => bePage([]) },
      post: { "/orders/ord-1/returns": (_p, body) => open(body) },
    });
    renderReturnScreen(card());
    const dialog = await openDialog();
    const submit = within(dialog).getByRole("button", { name: "Mở yêu cầu" });
    expect(submit).toBeDisabled();
    expect(within(dialog).queryByLabelText(/SL trả/)).toBeNull();

    await pickShipment(dialog, /Lô 2/);
    expect(within(dialog).getByText("≤ 4")).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText(/SL trả SKU-BAG-02/), "3");
    await userEvent.click(submit);
    await waitFor(() =>
      expect(open).toHaveBeenCalledWith(
        expect.objectContaining({
          shipmentId: "s-2",
          lines: [{ orderLineId: "ol-2", quantity: 3 }],
        }),
      ),
    );
  });

  it("the contract's window applies from the shipment's delivery: past it, a late reason is needed", async () => {
    const open = vi.fn((_body: unknown) => returnJson());
    mockReturnApi(SALES_GRANTS, {
      get: { "/returns": () => bePage([]) },
      post: { "/orders/ord-1/returns": (_p, body) => open(body) },
    });
    renderReturnScreen(card({ returnWindowDays: 10 }));
    const dialog = await openDialog();
    expect(within(dialog).getByText(/Trong 10 ngày sau khi lô hàng được giao/)).toBeVisible();
    await pickShipment(dialog, /Lô 1/);
    await userEvent.type(within(dialog).getByLabelText(/SL trả SKU-CUP-01/), "2");
    await userEvent.click(within(dialog).getByRole("button", { name: "Mở yêu cầu" }));
    expect(await within(dialog).findByText(/ghi lý do nhận ngoài hạn/)).toBeVisible();
    expect(open).not.toHaveBeenCalled();
  });

  it("explains RETURN_SHIPMENT_REQUIRED in Vietnamese", async () => {
    mockReturnApi(SALES_GRANTS, {
      get: { "/returns": () => bePage([]) },
      post: {
        "/orders/ord-1/returns": () => {
          throw apiError(422, "RETURN_SHIPMENT_REQUIRED");
        },
      },
    });
    renderReturnScreen(card());
    const dialog = await openDialog();
    await pickShipment(dialog, /Lô 2/);
    await userEvent.type(within(dialog).getByLabelText(/SL trả SKU-BAG-02/), "1");
    await userEvent.click(within(dialog).getByRole("button", { name: "Mở yêu cầu" }));
    expect(await within(dialog).findByText(/chọn lô giao chứa hàng khách trả/)).toBeVisible();
  });
});
