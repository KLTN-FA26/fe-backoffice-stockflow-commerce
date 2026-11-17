import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiError } from "@/test/api-screen";

import { ReturnDetail } from "..";
import {
  ACCOUNTANT_GRANTS,
  SALES_GRANTS,
  mockReturnApi,
  renderReturnScreen,
  returnJson,
} from "../__fixtures__/screen";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => vi.restoreAllMocks());

const received = (over: Record<string, unknown> = {}) =>
  returnJson({
    status: "RECEIVED",
    lines: [
      {
        id: "line-1",
        orderLineId: "ol-1",
        sku: "SKU-CUP-01",
        customPrinted: true,
        unitPrice: 100_000,
        requestedQuantity: 24,
        approvedQuantity: 20,
        receivedQuantity: 18,
        refundQuantity: 0,
      },
    ],
    review: { decidedAt: "2026-11-11T02:00:00Z", returnRequired: true },
    receipt: {
      receivedAt: "2026-11-13T04:00:00Z",
      locationCode: "WH1-QC01",
      goodsReceiptId: "gr-1",
    },
    ...over,
  });

const pending = () =>
  received({
    status: "SETTLEMENT_PENDING",
    resolution: {
      moneyMode: "REFUND",
      settlementAmount: 1_944_000,
      proposedAt: "2026-11-13T05:00:00Z",
      vatAdjustmentRequired: true,
    },
  });

describe("propose (Sales, RECEIVED)", () => {
  it("defaults each line to approved-and-back and sends the version", async () => {
    const propose = vi.fn((_body: unknown) => pending());
    mockReturnApi(SALES_GRANTS, {
      get: { "/returns/ret-1": () => received() },
      post: { "/returns/ret-1/resolution": (_p, body) => propose(body) },
    });
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    await userEvent.click(await screen.findByRole("button", { name: /Đề xuất hoàn tiền/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(/SL hoàn SKU-CUP-01/)).toHaveValue(18);
    expect(within(dialog).getByText("tối đa 18")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Gửi đề xuất" }));
    await waitFor(() =>
      expect(propose).toHaveBeenCalledWith(
        expect.objectContaining({ version: 2, lines: [{ lineId: "line-1", quantity: 18 }] }),
      ),
    );
  });

  it("more than approved-and-back is refused in the form", async () => {
    const propose = vi.fn();
    mockReturnApi(SALES_GRANTS, {
      get: { "/returns/ret-1": () => received() },
      post: { "/returns/ret-1/resolution": propose },
    });
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    await userEvent.click(await screen.findByRole("button", { name: /Đề xuất hoàn tiền/ }));
    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByLabelText(/SL hoàn SKU-CUP-01/);
    await userEvent.clear(input);
    await userEvent.type(input, "19");
    await userEvent.click(within(dialog).getByRole("button", { name: "Gửi đề xuất" }));
    expect(await within(dialog).findByText("Vượt số cho phép của dòng")).toBeInTheDocument();
    expect(propose).not.toHaveBeenCalled();
  });
});

describe("settlement (accountant, SETTLEMENT_PENDING)", () => {
  it("Sales cannot approve their own refund; the accountant can", async () => {
    mockReturnApi(SALES_GRANTS, { get: { "/returns/ret-1": () => pending() } });
    const view = renderReturnScreen(<ReturnDetail id="ret-1" />);
    await screen.findByText("Lem mực mặt trước");
    expect(screen.queryByRole("button", { name: /Duyệt hoàn tiền/ })).toBeNull();
    view.unmount();
    vi.restoreAllMocks();

    const approve = vi.fn((_body: unknown) => pending());
    mockReturnApi(ACCOUNTANT_GRANTS, {
      get: { "/returns/ret-1": () => pending() },
      post: { "/returns/ret-1/settlement-approval": (_p, body) => approve(body) },
    });
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    await userEvent.click(await screen.findByRole("button", { name: /Duyệt hoàn tiền/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Duyệt hoàn tiền" }));
    await waitFor(() => expect(approve).toHaveBeenCalledWith({ version: 2 }));
  });

  it("four eyes: RETURN_SELF_APPROVAL is explained in Vietnamese inside the dialog", async () => {
    mockReturnApi(ACCOUNTANT_GRANTS, {
      get: { "/returns/ret-1": () => pending() },
      post: {
        "/returns/ret-1/settlement-approval": () => {
          throw apiError(409, "RETURN_SELF_APPROVAL");
        },
      },
    });
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    await userEvent.click(await screen.findByRole("button", { name: /Duyệt hoàn tiền/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Duyệt hoàn tiền" }));
    expect(await within(dialog).findByText(/không tự duyệt được/)).toBeInTheDocument();
  });

  it("sending a refund back needs a reason", async () => {
    const reject = vi.fn((_body: unknown) => received());
    mockReturnApi(ACCOUNTANT_GRANTS, {
      get: { "/returns/ret-1": () => pending() },
      post: { "/returns/ret-1/settlement-rejection": (_p, body) => reject(body) },
    });
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    await userEvent.click(await screen.findByRole("button", { name: /Trả lại đề xuất/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByRole("textbox"), "Sai số lượng");
    await userEvent.click(within(dialog).getByRole("button", { name: "Trả lại" }));
    await waitFor(() =>
      expect(reject).toHaveBeenCalledWith({ reason: "Sai số lượng", version: 2 }),
    );
  });

  it("a resolved refund links to the accountant's refund screen", async () => {
    mockReturnApi(ACCOUNTANT_GRANTS, {
      get: {
        "/returns/ret-1": () =>
          received({
            status: "RESOLVED",
            resolution: {
              settlementAmount: 1_944_000,
              settledAt: "2026-11-14T03:00:00Z",
              offsetAmount: 0,
              refundedAmount: 1_944_000,
              vatAdjustmentRequired: true,
            },
          }),
      },
    });
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    expect(await screen.findByRole("link", { name: "Mở màn hoàn tiền" })).toHaveAttribute(
      "href",
      "/admin/payment/refunds/ord-1",
    );
    expect(screen.getByText("Cần hoá đơn điều chỉnh giảm")).toBeInTheDocument();
  });
});
