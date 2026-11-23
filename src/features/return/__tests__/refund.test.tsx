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

describe("WF-05 Q-4: no refund, with a fixed reason, through the same four-eyes approval", () => {
  it("every line at 0: the reason is required before sending, then sent with the public note", async () => {
    const propose = vi.fn((_body: unknown) => pending());
    mockReturnApi(SALES_GRANTS, {
      get: { "/returns/ret-1": () => received() },
      post: { "/returns/ret-1/resolution": (_p, body) => propose(body) },
    });
    const user = userEvent.setup();
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    await user.click(await screen.findByRole("button", { name: /Đề xuất hoàn tiền/ }));
    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByLabelText(/SL hoàn SKU-CUP-01/);
    await user.clear(input);
    await user.type(input, "0");
    await user.click(within(dialog).getByRole("button", { name: "Gửi đề xuất" }));
    expect(await within(dialog).findByText(/chọn lý do không hoàn/)).toBeInTheDocument();
    expect(propose).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("combobox", { name: /Lý do không hoàn/ }));
    await user.click(await screen.findByRole("option", { name: "Hư hỏng do bảo quản/sử dụng" }));
    await user.type(within(dialog).getByLabelText(/Ghi chú gửi khách/), "Ly bị ẩm do bảo quản");
    await user.click(within(dialog).getByRole("button", { name: "Gửi đề xuất" }));
    await waitFor(() =>
      expect(propose).toHaveBeenCalledWith({
        version: 2,
        lines: [{ lineId: "line-1", quantity: 0 }],
        refusalReason: "CUSTOMER_DAMAGE",
        refusalNote: "Ly bị ẩm do bảo quản",
      }),
    );
  });

  it("a partial refund sends no refusal reason", async () => {
    const propose = vi.fn((_body: unknown) => pending());
    mockReturnApi(SALES_GRANTS, {
      get: { "/returns/ret-1": () => received() },
      post: { "/returns/ret-1/resolution": (_p, body) => propose(body) },
    });
    const user = userEvent.setup();
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    await user.click(await screen.findByRole("button", { name: /Đề xuất hoàn tiền/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByRole("combobox", { name: /Lý do không hoàn/ })).toBeNull();
    await user.click(within(dialog).getByRole("button", { name: "Gửi đề xuất" }));
    await waitFor(() => expect(propose).toHaveBeenCalled());
    expect(propose.mock.calls[0]?.[0]).not.toHaveProperty("refusalReason");
  });

  it("BE RETURN_REFUSAL_REASON_REQUIRED is explained in Vietnamese", async () => {
    mockReturnApi(SALES_GRANTS, {
      get: { "/returns/ret-1": () => received() },
      post: {
        "/returns/ret-1/resolution": () => {
          throw apiError(400, "RETURN_REFUSAL_REASON_REQUIRED");
        },
      },
    });
    const user = userEvent.setup();
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    await user.click(await screen.findByRole("button", { name: /Đề xuất hoàn tiền/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Gửi đề xuất" }));
    expect(await within(dialog).findByText(/chọn lý do không hoàn/)).toBeInTheDocument();
  });

  it("the accountant approves a 0 proposal with the existing approval button; the dialog says no refund", async () => {
    const approve = vi.fn((_body: unknown) => pending());
    const zero = () =>
      received({
        status: "SETTLEMENT_PENDING",
        refusalReason: "CUSTOMER_DAMAGE",
        resolution: { settlementAmount: 0, proposedAt: "2026-11-13T05:00:00Z" },
      });
    mockReturnApi(ACCOUNTANT_GRANTS, {
      get: { "/returns/ret-1": zero },
      post: { "/returns/ret-1/settlement-approval": (_p, body) => approve(body) },
    });
    const user = userEvent.setup();
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    await user.click(await screen.findByRole("button", { name: /Duyệt hoàn tiền/ }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Duyệt kết quả: không hoàn tiền");
    expect(dialog).toHaveTextContent("Hư hỏng do bảo quản/sử dụng");
    expect(dialog).not.toHaveTextContent("0 ₫");
    await user.click(within(dialog).getByRole("button", { name: "Duyệt hoàn tiền" }));
    await waitFor(() => expect(approve).toHaveBeenCalledWith({ version: 2 }));
  });

  it("a resolved 0 refund never reads as refunded and shows the reason and public note", async () => {
    mockReturnApi(ACCOUNTANT_GRANTS, {
      get: {
        "/returns/ret-1": () =>
          received({
            status: "RESOLVED",
            outcome: "REFUSED",
            refusalReason: "CUSTOMER_DAMAGE",
            refusalNote: "Ly bị ẩm do bảo quản",
            resolution: {
              settlementAmount: 0,
              settledAt: "2026-11-14T03:00:00Z",
              offsetAmount: 0,
              refundedAmount: 0,
              vatAdjustmentRequired: false,
            },
          }),
      },
    });
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    expect(await screen.findByText("Đã xử lý — không hoàn tiền")).toBeInTheDocument();
    expect(screen.queryByText("Đã hoàn tiền")).toBeNull();
    expect(screen.getByText("Hư hỏng do bảo quản/sử dụng")).toBeInTheDocument();
    expect(screen.getByText("Ly bị ẩm do bảo quản")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Mở màn hoàn tiền" })).toBeNull();
  });

  it("an old BE (no outcome): a resolved 0 return still reads as no refund", async () => {
    mockReturnApi(ACCOUNTANT_GRANTS, {
      get: {
        "/returns/ret-1": () =>
          received({
            status: "RESOLVED",
            resolution: { settlementAmount: 0, settledAt: "2026-11-14T03:00:00Z" },
          }),
      },
    });
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    expect(await screen.findByText("Đã xử lý — không có gì để hoàn")).toBeInTheDocument();
    expect(screen.queryByText("Đã hoàn tiền")).toBeNull();
  });
});

describe("WF-05 BE-23: goods complete waits for the draft receipt", () => {
  const awaiting = (over: Record<string, unknown> = {}) =>
    received({
      status: "AWAITING_RETURN",
      receipt: {
        receivedAt: "2026-11-13T04:00:00Z",
        locationCode: "WH1-QC01",
        goodsReceiptId: "gr-1",
      },
      ...over,
    });

  it("no goods-complete button while a draft is being counted, and the reason is said", async () => {
    mockReturnApi(SALES_GRANTS, {
      get: { "/returns/ret-1": () => awaiting({ receiptDraftOpen: true }) },
    });
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    expect(await screen.findByText(/Kho đang đếm một phiếu nhập hàng hoàn/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Đã nhận đủ hàng/ })).toBeNull();
  });

  it("BE RETURN_RECEIPT_DRAFT_OPEN (a draft opened meanwhile) is explained", async () => {
    mockReturnApi(SALES_GRANTS, {
      get: { "/returns/ret-1": () => awaiting() },
      post: {
        "/returns/ret-1/goods-complete": () => {
          throw apiError(409, "RETURN_RECEIPT_DRAFT_OPEN");
        },
      },
    });
    const user = userEvent.setup();
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    await user.click(await screen.findByRole("button", { name: /Đã nhận đủ hàng/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /Đã nhận đủ hàng/ }));
    expect(
      await within(dialog).findByText(/Kho đang đếm một phiếu nhập hàng hoàn/),
    ).toBeInTheDocument();
  });
});

describe("WF-05 Q-4 (BE G4): withholding part of the goods", () => {
  it("a partial refund may say why the rest is withheld; the reason and note go with it", async () => {
    const propose = vi.fn((_body: unknown) => pending());
    mockReturnApi(SALES_GRANTS, {
      get: { "/returns/ret-1": () => received() },
      post: { "/returns/ret-1/resolution": (_p, body) => propose(body) },
    });
    const user = userEvent.setup();
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    await user.click(await screen.findByRole("button", { name: /Đề xuất hoàn tiền/ }));
    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByLabelText(/SL hoàn SKU-CUP-01/);
    await user.clear(input);
    await user.type(input, "10");
    await user.click(within(dialog).getByRole("combobox", { name: /Lý do không hoàn/ }));
    await user.click(await screen.findByRole("option", { name: "Lý do khác" }));
    await user.click(within(dialog).getByRole("button", { name: "Gửi đề xuất" }));
    // OTHER needs a note for the customer (BE VALIDATION_FAILED otherwise)
    expect(await within(dialog).findByText(/ghi rõ cho khách/)).toBeInTheDocument();
    expect(propose).not.toHaveBeenCalled();
    await user.type(
      within(dialog).getByLabelText(/Ghi chú gửi khách/),
      "8 ly in sai do file khách gửi",
    );
    await user.click(within(dialog).getByRole("button", { name: "Gửi đề xuất" }));
    await waitFor(() =>
      expect(propose).toHaveBeenCalledWith({
        version: 2,
        lines: [{ lineId: "line-1", quantity: 10 }],
        refusalReason: "OTHER",
        refusalNote: "8 ly in sai do file khách gửi",
      }),
    );
  });

  it("a reason picked, then every unit refunded again: the reason is not sent (BE refuses it)", async () => {
    const propose = vi.fn((_body: unknown) => pending());
    mockReturnApi(SALES_GRANTS, {
      get: { "/returns/ret-1": () => received() },
      post: { "/returns/ret-1/resolution": (_p, body) => propose(body) },
    });
    const user = userEvent.setup();
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    await user.click(await screen.findByRole("button", { name: /Đề xuất hoàn tiền/ }));
    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByLabelText(/SL hoàn SKU-CUP-01/);
    await user.clear(input);
    await user.type(input, "5");
    await user.click(within(dialog).getByRole("combobox", { name: /Lý do không hoàn/ }));
    await user.click(await screen.findByRole("option", { name: "Không phát hiện lỗi" }));
    await user.clear(input);
    await user.type(input, "18");
    await user.click(within(dialog).getByRole("button", { name: "Gửi đề xuất" }));
    await waitFor(() => expect(propose).toHaveBeenCalled());
    expect(propose.mock.calls[0]?.[0]).not.toHaveProperty("refusalReason");
    expect(propose.mock.calls[0]?.[0]).not.toHaveProperty("refusalNote");
  });

  it("approving a partial refund that carries a reason reads as a refund, with its amount", async () => {
    mockReturnApi(ACCOUNTANT_GRANTS, {
      get: {
        "/returns/ret-1": () =>
          received({
            status: "SETTLEMENT_PENDING",
            refusalReason: "NOT_DEFECTIVE",
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
                refundQuantity: 10,
              },
            ],
            resolution: { settlementAmount: 1_080_000, proposedAt: "2026-11-13T05:00:00Z" },
          }),
      },
    });
    const user = userEvent.setup();
    renderReturnScreen(<ReturnDetail id="ret-1" />);
    await user.click(await screen.findByRole("button", { name: /Duyệt hoàn tiền/ }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).not.toHaveTextContent("không hoàn tiền");
    expect(dialog).toHaveTextContent(/1\.080\.000/);
  });
});
