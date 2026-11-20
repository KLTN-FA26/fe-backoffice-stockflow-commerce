import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { apiError, bePage } from "@/test/api-screen";

import { ReceiptDetail, ReceiptList } from "..";
import {
  ACCOUNTANT_GRANTS,
  SALES_GRANTS,
  installmentJson,
  mockPaymentApi,
  receiptJson,
  renderPaymentScreen,
} from "../__fixtures__/screen";

const saveFile = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/file-download", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/file-download")>()),
  saveFile,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => vi.restoreAllMocks());

const detail = (over: Record<string, unknown> = {}) =>
  receiptJson({
    note: "Chuyển khoản đợt giao 1",
    lines: [
      {
        installmentId: "inst-2",
        amount: 25_000_000,
        contractNumber: "HD-20261108-000013-1",
        orderId: "ord-13",
        orderNumber: "SO-20261108-000013",
        seq: 2,
        name: "Trả trước khi nhận đợt giao 1",
        milestone: "BEFORE_DELIVERY",
      },
    ],
    ...over,
  });

describe("ReceiptList (docs 15 §5.3)", () => {
  it("lists receipts with their status; Recorded and Voided read differently", async () => {
    mockPaymentApi(ACCOUNTANT_GRANTS, {
      get: {
        "/payment-receipts": () =>
          bePage([
            receiptJson(),
            receiptJson({ receiptId: "rcp-2", reference: "FT26311999333", status: "VOIDED" }),
          ]),
      },
    });
    renderPaymentScreen(<ReceiptList />);
    expect(await screen.findByText("FT26313123456")).toBeInTheDocument();
    expect(screen.getByText("Đã ghi nhận")).toBeInTheDocument();
    expect(screen.getByText("Đã huỷ")).toBeInTheDocument();
  });

  it("names the customer on each receipt without asking the customer directory (QA A5, BE-15)", async () => {
    const api = mockPaymentApi(ACCOUNTANT_GRANTS, {
      get: {
        "/payment-receipts": () =>
          bePage([
            receiptJson({ customerName: "Công ty Bao Bì An Phát", customerCode: "0312345678" }),
          ]),
      },
    });
    renderPaymentScreen(<ReceiptList />, "?customerId=cust-9");
    // Row cell and the filter chip both carry the name taken from the rows.
    expect((await screen.findAllByText("Công ty Bao Bì An Phát")).length).toBe(2);
    expect(screen.queryByText(/^KH /)).not.toBeInTheDocument();
    expect(api.get.mock.calls.some(([url]) => String(url).startsWith("/customers"))).toBe(false);
  });

  it("sends the exact statement reference and status from the URL", async () => {
    const api = mockPaymentApi(ACCOUNTANT_GRANTS, {
      get: { "/payment-receipts": () => bePage([receiptJson()]) },
    });
    renderPaymentScreen(
      <ReceiptList />,
      "?reference=FT26313123456&status=RECORDED&customerId=cust-9",
    );
    await screen.findByText("FT26313123456");
    const query = (
      api.get.mock.calls.find(([url]) => url === "/payment-receipts")?.[1] as {
        params: URLSearchParams;
      }
    ).params;
    expect(Object.fromEntries(query)).toMatchObject({
      reference: "FT26313123456",
      status: "RECORDED",
      customerId: "cust-9",
    });
  });
});

describe("ReceiptDetail — void a wrongly entered receipt (docs 15 §4.4, BR-04)", () => {
  const routes = (post?: () => unknown) => ({
    get: { "/payment-receipts/rcp-1": () => detail() },
    post: {
      "/payment-receipts/rcp-1/void":
        post ?? (() => detail({ status: "VOIDED", voidReason: "Nhầm khách" })),
    },
  });

  it("accountant voids with a reason; holdOrders defaults to false", async () => {
    const api = mockPaymentApi(ACCOUNTANT_GRANTS, routes());
    renderPaymentScreen(<ReceiptDetail id="rcp-1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Huỷ phiếu thu" }));
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.type(dialog.getByLabelText(/Lý do huỷ phiếu thu/), "Nhầm khách");
    await userEvent.click(dialog.getByRole("button", { name: "Huỷ phiếu thu" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/payment-receipts/rcp-1/void", {
        reason: "Nhầm khách",
        holdOrders: false,
      }),
    );
  });

  it("a reason is required — nothing is sent without it", async () => {
    const api = mockPaymentApi(ACCOUNTANT_GRANTS, routes());
    renderPaymentScreen(<ReceiptDetail id="rcp-1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Huỷ phiếu thu" }));
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.click(dialog.getByRole("button", { name: "Huỷ phiếu thu" }));
    expect(await dialog.findByText("Nhập lý do")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it.each([
    [
      "PAYMENT_RECEIPT_VOID_NOT_ALLOWED",
      409,
      "Phiếu thu PT-1 đã trả cho đơn SO-9, không huỷ được.",
      /SO-9/,
    ],
    [
      "VALIDATION_FAILED",
      400,
      "Huỷ phiếu thu cần nêu lý do (tối thiểu 3 ký tự).",
      /Huỷ phiếu thu cần nêu lý do/,
    ],
  ])("a refused void shows the BE sentence (%s)", async (code, status, message, shown) => {
    mockPaymentApi(
      ACCOUNTANT_GRANTS,
      routes(() => {
        throw apiError(status, code, undefined, message);
      }),
    );
    renderPaymentScreen(<ReceiptDetail id="rcp-1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Huỷ phiếu thu" }));
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.type(dialog.getByLabelText(/Lý do huỷ phiếu thu/), "Nhầm khách");
    await userEvent.click(dialog.getByRole("button", { name: "Huỷ phiếu thu" }));
    expect(await dialog.findByText(shown)).toBeInTheDocument();
    expect(dialog.queryByText(/được đánh dấu/)).not.toBeInTheDocument();
  });

  it("BR-13: when the void leaves a confirmed order short, BE asks for the hold; ticking 'Treo đơn' retries with holdOrders", async () => {
    const post = vi
      .fn()
      .mockImplementationOnce(() => {
        throw apiError(409, "PAYMENT_RECEIPT_VOID_NEEDS_HOLD");
      })
      .mockImplementation(() => detail({ status: "VOIDED" }));
    const api = mockPaymentApi(ACCOUNTANT_GRANTS, routes(post));
    renderPaymentScreen(<ReceiptDetail id="rcp-1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Huỷ phiếu thu" }));
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.type(dialog.getByLabelText(/Lý do huỷ phiếu thu/), "Ghi sai số tiền");
    await userEvent.click(dialog.getByRole("button", { name: "Huỷ phiếu thu" }));
    expect(
      await dialog.findByText(/Huỷ phiếu này làm đơn đã xác nhận thiếu đợt khi ký/),
    ).toBeInTheDocument();
    await userEvent.click(dialog.getByRole("checkbox"));
    await userEvent.click(dialog.getByRole("button", { name: "Huỷ phiếu thu" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenLastCalledWith("/payment-receipts/rcp-1/void", {
        reason: "Ghi sai số tiền",
        holdOrders: true,
      }),
    );
  });

  it("a voided receipt keeps its history and shows no void button", async () => {
    mockPaymentApi(ACCOUNTANT_GRANTS, {
      get: {
        "/payment-receipts/rcp-1": () =>
          detail({
            status: "VOIDED",
            voidedAt: "2026-11-11T03:00:00Z",
            voidReason: "Nhầm khách",
          }),
      },
    });
    renderPaymentScreen(<ReceiptDetail id="rcp-1" />);
    expect(await screen.findByText(/Nhầm khách/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Huỷ phiếu thu" })).not.toBeInTheDocument();
  });

  it("without payment-receipts:UPDATE the receipt is readable but cannot be voided", async () => {
    mockPaymentApi(
      ACCOUNTANT_GRANTS.filter((code) => code !== "payment-receipts:UPDATE"),
      routes(),
    );
    renderPaymentScreen(<ReceiptDetail id="rcp-1" />);
    expect(await screen.findByText("FT26313123456")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Huỷ phiếu thu" })).not.toBeInTheDocument();
  });

  it("a user without payment-receipts permissions is refused the page", async () => {
    mockPaymentApi(SALES_GRANTS, routes());
    renderPaymentScreen(<ReceiptDetail id="rcp-1" />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("FT26313123456")).not.toBeInTheDocument();
  });

  it("lists the installments the receipt paid, linked to their detail", async () => {
    mockPaymentApi(ACCOUNTANT_GRANTS, routes());
    renderPaymentScreen(<ReceiptDetail id="rcp-1" />);
    const line = (await screen.findByText(/Trả trước khi nhận đợt giao 1/)).closest("li")!;
    expect(within(line).getByText("Trước khi giao")).toBeInTheDocument();
    expect(within(line).getByRole("link", { name: "HD-20261108-000013-1" })).toHaveAttribute(
      "href",
      "/admin/payment/installments/inst-2",
    );
    expect(installmentJson().installmentId).toBe("inst-2");
  });
});

describe("WF-02 mục 36 — ngày nhận, tổng, xuất Excel", () => {
  const listCalls = () =>
    vi
      .mocked(api.get)
      .mock.calls.filter(([url]) => url === "/payment-receipts")
      .map(([, config]) => config?.params as URLSearchParams);
  const summary = { count: 3, totalAmount: 75_000_000, currency: "VND", byCurrency: [] };
  const routes = (over: Record<string, () => unknown> = {}) => ({
    get: {
      "/payment-receipts": () => bePage([receiptJson()]),
      "/payment-receipts/summary": () => summary,
      ...over,
    },
  });

  it("lọc ngày gửi receivedFrom/receivedTo và về trang 1 khi đổi ngày", async () => {
    mockPaymentApi(ACCOUNTANT_GRANTS, routes());
    renderPaymentScreen(<ReceiptList />, "?receivedFrom=2026-11-10&receivedTo=2026-11-30&page=3");
    await waitFor(() => expect(listCalls().length).toBeGreaterThan(0));
    const first = listCalls().at(-1)!;
    expect(first.get("receivedFrom")).toBe("2026-11-10");
    expect(first.get("receivedTo")).toBe("2026-11-30");
    expect(first.get("page")).toBe("2");
    await userEvent.click(screen.getByLabelText(/Nhận từ ngày/));
    const day = await screen.findByRole("gridcell", { name: /15/ });
    await userEvent.click(within(day).getByRole("button"));
    await waitFor(() => expect(listCalls().at(-1)?.get("receivedFrom")).toBe("2026-11-15"));
    expect(listCalls().at(-1)?.get("page")).toBe("0");
  });

  it("hiện số phiếu và tổng từ /summary, kèm bộ lọc", async () => {
    const api = mockPaymentApi(ACCOUNTANT_GRANTS, routes());
    renderPaymentScreen(<ReceiptList />, "?receivedFrom=2026-11-10");
    expect(await screen.findByText("3 phiếu thu")).toBeInTheDocument();
    expect(screen.getByText(/75\.000\.000/)).toBeInTheDocument();
    expect(screen.getByText(/Không tính phiếu đã huỷ/)).toBeInTheDocument();
    const call = api.get.mock.calls.find(([url]) => url === "/payment-receipts/summary");
    expect((call?.[1] as { params: URLSearchParams }).params.get("receivedFrom")).toBe(
      "2026-11-10",
    );
  });

  it("nhiều loại tiền: không có totalAmount thì liệt kê từng loại", async () => {
    mockPaymentApi(
      ACCOUNTANT_GRANTS,
      routes({
        "/payment-receipts/summary": () => ({
          count: 2,
          byCurrency: [
            { currency: "VND", count: 1, totalAmount: 10_000_000 },
            { currency: "USD", count: 1, totalAmount: 500 },
          ],
        }),
      }),
    );
    renderPaymentScreen(<ReceiptList />);
    expect(await screen.findByText(/10\.000\.000/)).toBeInTheDocument();
    expect(screen.getByText(/\$500/)).toBeInTheDocument();
  });

  it("không có payment-receipts:EXPORT thì không có nút Xuất Excel", async () => {
    mockPaymentApi(
      ACCOUNTANT_GRANTS.filter((code) => code !== "payment-receipts:EXPORT"),
      routes(),
    );
    renderPaymentScreen(<ReceiptList />);
    await screen.findByText("3 phiếu thu");
    expect(screen.queryByRole("button", { name: "Xuất Excel" })).not.toBeInTheDocument();
  });

  it("Xuất Excel gọi /export với cùng bộ lọc rồi lưu file", async () => {
    saveFile.mockClear();
    const url = "/payment-receipts/export?receivedFrom=2026-11-10&receivedTo=2026-11-30";
    const spy = mockPaymentApi(ACCOUNTANT_GRANTS, routes());
    const base = spy.get.getMockImplementation()!;
    spy.get.mockImplementation(async (path, config) =>
      path === url
        ? {
            data: new Blob(["x"]),
            headers: { "content-disposition": 'attachment; filename="payment-receipts-1.xlsx"' },
          }
        : base(path, config),
    );
    renderPaymentScreen(<ReceiptList />, "?receivedFrom=2026-11-10&receivedTo=2026-11-30");
    await userEvent.click(await screen.findByRole("button", { name: "Xuất Excel" }));
    await waitFor(() => expect(saveFile).toHaveBeenCalled());
    expect(saveFile.mock.calls[0]?.[0]).toMatchObject({ fileName: "payment-receipts-1.xlsx" });
    const call = spy.get.mock.calls.find(([path]) => path === url);
    expect((call?.[1] as { headers: { Accept: string } }).headers.Accept).toContain(
      "spreadsheetml.sheet",
    );
  });

  it("EXPORT_TOO_LARGE hiện câu FE, không lộ câu tiếng Anh của BE", async () => {
    const spy = mockPaymentApi(ACCOUNTANT_GRANTS, routes());
    const base = spy.get.getMockImplementation()!;
    spy.get.mockImplementation(async (path, config) => {
      if (String(path).startsWith("/payment-receipts/export"))
        throw apiError(422, "EXPORT_TOO_LARGE", undefined, "Export has more than 50000 rows");
      return base(path, config);
    });
    renderPaymentScreen(<ReceiptList />);
    await userEvent.click(await screen.findByRole("button", { name: "Xuất Excel" }));
    expect(await screen.findByText(/hơn 50\.000 dòng/)).toBeInTheDocument();
    expect(screen.queryByText(/Export has more/)).not.toBeInTheDocument();
  });

  it("khoảng ngày ngược báo lỗi tại ô và không gọi BE", async () => {
    const spy = mockPaymentApi(ACCOUNTANT_GRANTS, routes());
    renderPaymentScreen(<ReceiptList />, "?receivedFrom=2026-11-30&receivedTo=2026-11-10");
    expect(await screen.findByText("Từ ngày phải trước hoặc bằng Đến ngày")).toBeInTheDocument();
    expect(screen.getByLabelText(/Nhận từ ngày/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Xuất Excel" })).toBeDisabled();
    const sent = spy.get.mock.calls.filter(([url]) => String(url).startsWith("/payment-receipts"));
    expect(sent).toHaveLength(0);
  });
});
