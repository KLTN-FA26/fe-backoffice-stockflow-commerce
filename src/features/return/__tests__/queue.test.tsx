import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiError, bePage } from "@/test/api-screen";

import { OrderReturnsCard, ReturnDetail, ReturnList } from "..";
import {
  ACCOUNTANT_GRANTS,
  SALES_GRANTS,
  WAREHOUSE_GRANTS,
  mockReturnApi,
  renderReturnScreen,
  returnJson,
  returnRowJson,
} from "../__fixtures__/screen";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => vi.restoreAllMocks());

describe("ReturnList", () => {
  it("open tab asks the BE for the open statuses and links each RMA", async () => {
    const list = vi.fn((_params: unknown) => bePage([returnRowJson()]));
    mockReturnApi(SALES_GRANTS, { get: { "/returns": (params) => list(params) } });
    renderReturnScreen(<ReturnList />);
    expect(await screen.findByRole("link", { name: "RMA-20261110-0001" })).toHaveAttribute(
      "href",
      "/admin/orders/returns/ret-1",
    );
    const params = list.mock.calls[0]?.[0] as URLSearchParams;
    expect(params.getAll("status")).toEqual([
      "REQUESTED",
      "AWAITING_RETURN",
      "RECEIVED",
      "SETTLEMENT_PENDING",
    ]);
  });

  it("vatAdjustment=true lists resolved returns with a link to the order's e-invoices (docs 21 §4.4)", async () => {
    const list = vi.fn((_params: unknown) =>
      bePage([returnRowJson({ status: "RESOLVED", vatAdjustmentRequired: true })]),
    );
    mockReturnApi(ACCOUNTANT_GRANTS, { get: { "/returns": (params) => list(params) } });
    renderReturnScreen(<ReturnList />, "?vatAdjustment=true");
    expect(await screen.findByRole("link", { name: "Mở hoá đơn của đơn" })).toHaveAttribute(
      "href",
      expect.stringContaining("ord-1"),
    );
    const params = list.mock.calls[0]?.[0] as URLSearchParams;
    expect(params.get("vatAdjustment")).toBe("true");
    expect(params.getAll("status")).toEqual([]);
  });
});

describe("ReturnDetail — action gating by role", () => {
  it("Sales approve with per-line units and the version shown", async () => {
    const approve = vi.fn((_body: unknown) => returnJson({ status: "AWAITING_RETURN" }));
    mockReturnApi(SALES_GRANTS, {
      get: { "/returns/ret-1": () => returnJson() },
      post: { "/returns/ret-1/approval": (_p, body) => approve(body) },
    });
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    await userEvent.click(await screen.findByRole("button", { name: /Duyệt/ }));
    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByLabelText(/SL duyệt SKU-CUP-01/);
    await userEvent.clear(input);
    await userEvent.type(input, "20");
    await userEvent.click(within(dialog).getByRole("button", { name: "Duyệt" }));
    await waitFor(() =>
      expect(approve).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 2,
          lines: [{ lineId: "line-1", approvedQuantity: 20 }],
        }),
      ),
    );
  });

  it("the accountant and the warehouse see no decision on a REQUESTED claim", async () => {
    for (const grants of [ACCOUNTANT_GRANTS, WAREHOUSE_GRANTS]) {
      mockReturnApi(grants, { get: { "/returns/ret-1": () => returnJson() } });
      const view = renderReturnScreen(<ReturnDetail id="ret-1" />);
      await screen.findByText("Lem mực mặt trước");
      expect(screen.queryByRole("button", { name: /Duyệt|Từ chối/ })).toBeNull();
      view.unmount();
      vi.restoreAllMocks();
    }
  });

  it("a rejection without a reason cannot be sent; BE errors stay in the dialog in Vietnamese", async () => {
    mockReturnApi(SALES_GRANTS, {
      get: { "/returns/ret-1": () => returnJson() },
      post: {
        "/returns/ret-1/rejection": () => {
          throw apiError(409, "OPTIMISTIC_LOCK");
        },
      },
    });
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    await userEvent.click(await screen.findByRole("button", { name: /Từ chối/ }));
    const dialog = await screen.findByRole("dialog");
    const submit = within(dialog).getByRole("button", { name: "Từ chối" });
    expect(submit).toBeDisabled();
    await userEvent.type(within(dialog).getByRole("textbox"), "Màu nằm trong dung sai");
    await userEvent.click(submit);
    expect(await within(dialog).findByText(/Người khác vừa thay đổi/)).toBeInTheDocument();
  });

  it("a resolved return renders no mutating button", async () => {
    mockReturnApi(SALES_GRANTS, {
      get: { "/returns/ret-1": () => returnJson({ status: "RESOLVED" }) },
    });
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    await screen.findByText("Lem mực mặt trước");
    expect(screen.queryByRole("button", { name: /Duyệt|Từ chối|Rút/ })).toBeNull();
  });
});

describe("OrderReturnsCard", () => {
  // Giao 2026-11-14 → đồng hồ cố định trong hạn 7 ngày; không thì test hết hạn theo ngày chạy
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-16T03:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  const card = (status: string) => (
    <OrderReturnsCard
      orderId="ord-1"
      orderNumber="SO-1"
      status={status}
      deliveredAt="2026-11-14T03:00:00Z"
      lines={[{ lineId: "ol-1", sku: "SKU-CUP-01", deliveredQuantity: 24, customPrinted: true }]}
    />
  );

  it("is not shown on an undelivered order without returns", async () => {
    const list = vi.fn(() => bePage([]));
    mockReturnApi(SALES_GRANTS, { get: { "/returns": list } });
    const view = renderReturnScreen(card("Picking"));
    await waitFor(() => expect(list).toHaveBeenCalled());
    expect(view.container).toBeEmptyDOMElement();
  });

  it("Sales open a claim for the customer with the lines chosen", async () => {
    const open = vi.fn((_body: unknown) => returnJson());
    mockReturnApi(SALES_GRANTS, {
      get: { "/returns": () => bePage([]) },
      post: { "/orders/ord-1/returns": (_p, body) => open(body) },
    });
    renderReturnScreen(card("Delivered"));
    await userEvent.click(await screen.findByRole("button", { name: /Mở yêu cầu trả hàng/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/SL trả SKU-CUP-01/), "3");
    await userEvent.click(within(dialog).getByRole("button", { name: "Mở yêu cầu" }));
    await waitFor(() =>
      expect(open).toHaveBeenCalledWith(
        expect.objectContaining({
          reasonCode: "PRINT_DEFECT",
          requestedResolution: "REFUND",
          lines: [{ orderLineId: "ol-1", quantity: 3 }],
        }),
      ),
    );
  });
});
