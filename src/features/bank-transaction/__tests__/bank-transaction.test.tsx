import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BANK_TRANSACTION_PERMISSIONS } from "@/constants/bank-transaction";
import { bePage, mockApi, renderScreen } from "@/test/api-screen";

import { BankTransactionDetail } from "../components/BankTransactionDetail";
import { BankTransactionList } from "../components/BankTransactionList";
import { allowedBankTransactionActions, BANK_TRANSACTION_TRANSITIONS } from "../lifecycle";
import { matchingInstallments, payableInstallments, reviewReasonText } from "../selectors";
import { dayAfterStartInstant, dayStartInstant } from "../api";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const ID = "55555555-0000-4000-8000-0000000000d1";
const CUSTOMER_ID = "66666666-0000-4000-8000-0000000000d2";
const INSTALLMENT_ID = "77777777-0000-4000-8000-0000000000d3";
const needsReview = {
  id: ID,
  provider: "SEPAY",
  source: "WEBHOOK",
  providerTransactionId: "92704",
  accountNumber: "0071000888888",
  amount: 660_000,
  currency: "VND",
  content: "HD-20261126-0001-1 DOT2",
  bankReference: "FT26330123456",
  transactionAt: "2026-11-26T03:00:00Z",
  receivedAt: "2026-11-26T03:00:05Z",
  status: "NEEDS_REVIEW",
  reviewReason: "OVERPAYMENT",
  reviewNote: "Amount 660000 exceeds outstanding 600000",
  customerId: CUSTOMER_ID,
  customerName: "Công ty Ly Giấy Xanh",
  customerCode: "KH-0001",
  installmentId: INSTALLMENT_ID,
  automatic: false,
};
const installment = {
  installmentId: INSTALLMENT_ID,
  contractNumber: "HD-20261126-0001-1",
  orderNumber: "SO-0001",
  customerId: CUSTOMER_ID,
  seq: 2,
  name: "Đợt 2",
  outstanding: 600_000,
  currency: "VND",
  status: "DUE",
};
const DETAIL = `/bank-transactions/${ID}`;

type GetSpy = { mock: { calls: unknown[][] } };
const paramsOf = (call: unknown[] | undefined) =>
  (call?.[1] as { params: URLSearchParams } | undefined)?.params;
/** Lần gọi danh sách của bảng — bỏ lần đếm hàng chờ cho tab (`size=1`). */
const tableCalls = (get: GetSpy) =>
  get.mock.calls
    .filter((call) => call[0] === "/bank-transactions" && paramsOf(call)?.get("size") !== "1")
    .map((call) => paramsOf(call)!);

afterEach(() => vi.restoreAllMocks());

describe("BANK_TRANSACTION_TRANSITIONS + gating (phần C)", () => {
  it("IGNORED / UNKNOWN là cuối; APPLIED chỉ quay lại hàng chờ khi phiếu thu bị huỷ", () => {
    expect(BANK_TRANSACTION_TRANSITIONS.IGNORED).toEqual([]);
    expect(BANK_TRANSACTION_TRANSITIONS.UNKNOWN).toEqual([]);
    expect(BANK_TRANSACTION_TRANSITIONS.APPLIED).toEqual(["NEEDS_REVIEW"]);
  });
  it("chỉ NEEDS_REVIEW + UPDATE mới gán / bỏ qua", () => {
    const update = (code: string) => code === BANK_TRANSACTION_PERMISSIONS.update;
    expect(allowedBankTransactionActions("NEEDS_REVIEW", update)).toEqual(["assign", "ignore"]);
    expect(allowedBankTransactionActions("APPLIED", update)).toEqual([]);
    expect(allowedBankTransactionActions("NEEDS_REVIEW", () => false)).toEqual([]);
  });
  it("đợt đã trả đủ / đã huỷ không vào form gán", () => {
    expect(
      payableInstallments([
        installment,
        { ...installment, installmentId: "x", status: "PAID", outstanding: 0 },
        { ...installment, installmentId: "y", status: "CANCELLED" },
      ]).map((row) => row.installmentId),
    ).toEqual([INSTALLMENT_ID]);
  });
});

describe("Danh sách giao dịch ngân hàng", () => {
  it("mặc định tab Chờ xử lý gửi status=NEEDS_REVIEW; tab Tất cả không gửi status", async () => {
    const { get } = mockApi("ACCOUNTANT", {
      get: { "/bank-transactions": () => bePage([needsReview]) },
    });
    renderScreen(<BankTransactionList />, "ACCOUNTANT");
    expect(await screen.findByText("Số tiền lớn hơn số còn phải thu của đợt")).toBeInTheDocument();
    const statusOf = (index: number) => tableCalls(get)[index]?.get("status");
    expect(statusOf(0)).toBe("NEEDS_REVIEW");
    await userEvent.click(screen.getByRole("tab", { name: "Tất cả" }));
    await waitFor(() => expect(statusOf(1)).toBeNull());
  });
});

describe("Chi tiết giao dịch — gán / bỏ qua", () => {
  it("Gán: điền sẵn khách + đợt gợi ý; gửi customerId + lines đã sửa", async () => {
    const { post } = mockApi("ACCOUNTANT", {
      get: {
        [DETAIL]: () => needsReview,
        "/installments": () => bePage([installment]),
        [`/customers/${CUSTOMER_ID}`]: () => ({
          customerId: CUSTOMER_ID,
          name: "Công ty Ly Giấy Xanh",
        }),
      },
      post: { [`${DETAIL}/assignment`]: () => ({ ...needsReview, status: "APPLIED" }) },
    });
    renderScreen(<BankTransactionDetail id={ID} />, "ACCOUNTANT");
    await userEvent.click(await screen.findByRole("button", { name: /Gán vào đợt/ }));
    const dialog = await screen.findByRole("dialog");
    const amount = await within(dialog).findByLabelText(/Số tiền gán/);
    await userEvent.clear(amount);
    await userEvent.type(amount, "600000");
    await userEvent.click(within(dialog).getByRole("button", { name: "Gán và lập phiếu thu" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`${DETAIL}/assignment`, {
        customerId: CUSTOMER_ID,
        lines: [{ installmentId: INSTALLMENT_ID, amount: 600_000 }],
        note: "",
      }),
    );
  });

  it("Đợt gợi ý được điền sẵn min(số tiền giao dịch, còn phải thu)", async () => {
    mockApi("ACCOUNTANT", {
      get: {
        [DETAIL]: () => needsReview,
        "/installments": () => bePage([installment]),
        [`/customers/${CUSTOMER_ID}`]: () => ({
          customerId: CUSTOMER_ID,
          name: "Công ty Ly Giấy Xanh",
        }),
      },
    });
    renderScreen(<BankTransactionDetail id={ID} />, "ACCOUNTANT");
    await userEvent.click(await screen.findByRole("button", { name: /Gán vào đợt/ }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByLabelText(/Số tiền gán/)).toHaveValue("600000");
  });

  it("NOT_PAYABLE: đợt gợi ý đã trả đủ → không tính, không gửi ngầm; nút khoá tới khi chọn đợt", async () => {
    mockApi("ACCOUNTANT", {
      get: {
        [DETAIL]: () => ({ ...needsReview, reviewReason: "NOT_PAYABLE" }),
        "/installments": () => bePage([{ ...installment, status: "PAID", outstanding: 0 }]),
        [`/customers/${CUSTOMER_ID}`]: () => ({
          customerId: CUSTOMER_ID,
          name: "Công ty Ly Giấy Xanh",
        }),
      },
    });
    renderScreen(<BankTransactionDetail id={ID} />, "ACCOUNTANT");
    await userEvent.click(await screen.findByRole("button", { name: /Gán vào đợt/ }));
    const dialog = await screen.findByRole("dialog");
    expect(
      await within(dialog).findByText("Khách không có đợt nào còn phải thu."),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/Đã gán 0/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Gán và lập phiếu thu" })).toBeDisabled();
  });

  it("Gán vượt số tiền giao dịch → báo ngay, khoá nút", async () => {
    mockApi("ACCOUNTANT", {
      get: {
        [DETAIL]: () => needsReview,
        "/installments": () => bePage([installment]),
        [`/customers/${CUSTOMER_ID}`]: () => ({
          customerId: CUSTOMER_ID,
          name: "Công ty Ly Giấy Xanh",
        }),
      },
    });
    renderScreen(<BankTransactionDetail id={ID} />, "ACCOUNTANT");
    await userEvent.click(await screen.findByRole("button", { name: /Gán vào đợt/ }));
    const dialog = await screen.findByRole("dialog");
    const amount = await within(dialog).findByLabelText(/Số tiền gán/);
    await userEvent.clear(amount);
    await userEvent.type(amount, "700000");
    expect(within(dialog).getByText(/vượt số tiền của giao dịch/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Gán và lập phiếu thu" })).toBeDisabled();
  });

  it("Bỏ qua: lý do bắt buộc, gửi tới /ignore", async () => {
    const { post } = mockApi("ACCOUNTANT", {
      get: { [DETAIL]: () => needsReview },
      post: { [`${DETAIL}/ignore`]: () => ({ ...needsReview, status: "IGNORED" }) },
    });
    renderScreen(<BankTransactionDetail id={ID} />, "ACCOUNTANT");
    await userEvent.click(await screen.findByRole("button", { name: /Bỏ qua/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByRole("textbox"), "Tiền chuyển nhầm");
    await userEvent.click(within(dialog).getByRole("button", { name: "Bỏ qua" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`${DETAIL}/ignore`, { reason: "Tiền chuyển nhầm" }),
    );
  });

  it("Đã tự lập phiếu thu → không nút, người xử lý 'Tự động', link phiếu thu", async () => {
    mockApi("ACCOUNTANT", {
      get: {
        [DETAIL]: () => ({
          ...needsReview,
          status: "APPLIED",
          reviewReason: null,
          automatic: true,
          receiptId: "r-1",
          receiptReference: "FT26330123456",
          decidedAt: "2026-11-26T03:00:06Z",
        }),
      },
    });
    renderScreen(<BankTransactionDetail id={ID} />, "ACCOUNTANT");
    expect(await screen.findByText("Tự động")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "FT26330123456" })).toHaveAttribute(
      "href",
      "/admin/payment/receipts/r-1",
    );
    expect(screen.queryByRole("button", { name: /Gán vào đợt/ })).not.toBeInTheDocument();
  });
});

describe("bo-25: hàng chờ giao dịch ngân hàng", () => {
  it("tab Chờ xử lý có số đếm của cả hàng chờ (một trang 1 dòng, totalElements)", async () => {
    mockApi("ACCOUNTANT", {
      get: {
        "/bank-transactions": (params) =>
          (params as URLSearchParams).get("size") === "1"
            ? { ...bePage([needsReview]), totalElements: 4 }
            : bePage([needsReview]),
      },
    });
    renderScreen(<BankTransactionList />, "ACCOUNTANT");
    expect(await screen.findByRole("tab", { name: /Chờ xử lý\s*4/ })).toBeInTheDocument();
  });

  it("dòng chờ xử lý có menu ⋯ với 'Gắn vào đợt' mở hộp thoại gán; dòng đã xử lý chỉ có 'Xem chi tiết'", async () => {
    mockApi("ACCOUNTANT", {
      get: {
        "/bank-transactions": () =>
          bePage([
            needsReview,
            { ...needsReview, id: "applied-1", status: "APPLIED", amount: 5_000 },
          ]),
        "/installments": () => bePage([installment]),
        [`/customers/${CUSTOMER_ID}`]: () => ({
          customerId: CUSTOMER_ID,
          name: "Công ty Ly Giấy Xanh",
        }),
      },
    });
    renderScreen(<BankTransactionList />, "ACCOUNTANT", "?tab=all");
    await userEvent.click(
      await screen.findByRole("button", { name: /^Thao tác — giao dịch 5\.000/ }),
    );
    let menu = await screen.findByRole("dialog");
    expect(within(menu).queryByRole("button", { name: "Gắn vào đợt" })).not.toBeInTheDocument();
    expect(within(menu).getByRole("link", { name: "Xem chi tiết" })).toHaveAttribute(
      "href",
      "/admin/payment/bank-transactions/applied-1",
    );
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: /^Thao tác — giao dịch 660/ }));
    menu = await screen.findByRole("dialog");
    await userEvent.click(within(menu).getByRole("button", { name: "Gắn vào đợt" }));
    expect(
      await screen.findByRole("dialog", { name: "Gán vào đợt thanh toán" }),
    ).toBeInTheDocument();
  });

  it("ngày trên URL đi thành from / to Instant (to = 00:00 ngày hôm sau, BE loại trừ) và có chip để bỏ", async () => {
    const { get } = mockApi("ACCOUNTANT", {
      get: { "/bank-transactions": () => bePage([needsReview]) },
    });
    renderScreen(<BankTransactionList />, "ACCOUNTANT", "?from=2026-11-01&to=2026-11-26");
    await screen.findByText("Số tiền lớn hơn số còn phải thu của đợt");
    const params = tableCalls(get)[0]!;
    expect(params.get("from")).toBe(dayStartInstant("2026-11-01"));
    expect(params.get("to")).toBe(dayAfterStartInstant("2026-11-26"));
    expect(dayStartInstant("2026-11-01")).toBe("2026-10-31T17:00:00.000Z");
    expect(dayAfterStartInstant("2026-11-26")).toBe("2026-11-26T17:00:00.000Z");
    // Số đếm của tab không theo lọc ngày
    const count = get.mock.calls.find(
      (call) => call[0] === "/bank-transactions" && paramsOf(call)?.get("size") === "1",
    );
    expect(paramsOf(count)?.has("from")).toBe(false);
    expect(screen.getByText(/Ngày giao dịch/)).toBeInTheDocument();
  });
});

describe("bo-25: lọc đúng số tiền", () => {
  it("?amount= trên URL đi thành amount gửi BE, có chip; số đếm của tab không theo lọc này", async () => {
    const { get } = mockApi("ACCOUNTANT", {
      get: { "/bank-transactions": () => bePage([needsReview]) },
    });
    renderScreen(<BankTransactionList />, "ACCOUNTANT", "?amount=660000");
    await screen.findByText("Số tiền lớn hơn số còn phải thu của đợt");
    expect(tableCalls(get)[0]?.get("amount")).toBe("660000");
    const count = get.mock.calls.find(
      (call) => call[0] === "/bank-transactions" && paramsOf(call)?.get("size") === "1",
    );
    expect(paramsOf(count)?.has("amount")).toBe(false);
  });

  it("gõ số tiền ở header cột → gửi BE sau khi ngừng gõ", async () => {
    const { get } = mockApi("ACCOUNTANT", {
      get: { "/bank-transactions": () => bePage([needsReview]) },
    });
    renderScreen(<BankTransactionList />, "ACCOUNTANT");
    await screen.findByText("Số tiền lớn hơn số còn phải thu của đợt");
    await userEvent.click(screen.getByRole("button", { name: "Lọc số tiền" }));
    await userEvent.type(await screen.findByLabelText("Đúng số tiền"), "660000");
    await waitFor(() => expect(tableCalls(get).at(-1)?.get("amount")).toBe("660000"));
  });

  it("BE cũ bỏ qua amount → trang vẫn chỉ hiện giao dịch đúng số tiền", async () => {
    mockApi("ACCOUNTANT", {
      get: {
        "/bank-transactions": () =>
          bePage([needsReview, { ...needsReview, id: "other", amount: 5_000 }]),
      },
    });
    renderScreen(<BankTransactionList />, "ACCOUNTANT", "?tab=all&amount=660000");
    await screen.findByRole("button", { name: /^Thao tác — giao dịch 660/ });
    expect(screen.queryByRole("button", { name: /^Thao tác — giao dịch 5\.000/ })).toBeNull();
  });
});

describe("bo-26: chi tiết giao dịch chỉ hiện câu tiếng Việt; gợi ý đợt cùng số tiền", () => {
  it("không hiện reviewNote tiếng Anh; mã lý do lạ → câu chung, không hiện mã", async () => {
    mockApi("ACCOUNTANT", {
      get: {
        [DETAIL]: () => ({
          ...needsReview,
          reviewReason: "NO_INSTALLMENT_NAMED",
          reviewNote: "The transfer's content names no contract installment",
          customerId: null,
          installmentId: null,
        }),
        "/installments": () => bePage([]),
      },
    });
    renderScreen(<BankTransactionDetail id={ID} />, "ACCOUNTANT");
    expect(await screen.findByText("Nội dung không có mã hợp đồng và mã đợt")).toBeInTheDocument();
    expect(screen.queryByText(/names no contract installment/)).not.toBeInTheDocument();
    expect(reviewReasonText("SOMETHING_NEW")).toBe("Cần Kế toán xem lại giao dịch");
  });

  it("khách nhận ra: liệt kê đợt của khách còn phải thu đúng bằng số tiền; 'Gắn' mở hộp thoại chọn sẵn đợt đó", async () => {
    const exact = {
      ...installment,
      installmentId: "exact-1",
      seq: 3,
      name: "Còn lại",
      outstanding: 660_000,
    };
    const { get, post } = mockApi("ACCOUNTANT", {
      get: {
        [DETAIL]: () => needsReview,
        "/installments": () => bePage([installment, exact]),
        [`/customers/${CUSTOMER_ID}`]: () => ({
          customerId: CUSTOMER_ID,
          name: "Công ty Ly Giấy Xanh",
        }),
      },
      post: { [`${DETAIL}/assignment`]: () => ({ ...needsReview, status: "APPLIED" }) },
    });
    renderScreen(<BankTransactionDetail id={ID} />, "ACCOUNTANT");
    const block = await screen.findByRole("region", { name: "Đợt có thể khớp" });
    expect(await within(block).findByText(/Đợt 3/)).toBeInTheDocument();
    expect(within(block).queryByText(/Đợt 2/)).not.toBeInTheDocument();
    const call = get.mock.calls.find((c) => c[0] === "/installments");
    expect(paramsOf(call)?.get("customerId")).toBe(CUSTOMER_ID);
    // BE lọc đúng số tiền (PR #497); khách nhận ra → cả đợt chưa đến hạn (không owing)
    expect(paramsOf(call)?.get("outstanding")).toBe("660000");
    expect(paramsOf(call)?.has("owing")).toBe(false);
    await userEvent.click(
      within(block).getByRole("button", { name: "Gắn vào HD-20261126-0001-1 đợt 3" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(
      await within(dialog).findByLabelText(/Số tiền gán HD-20261126-0001-1 đợt 3/),
    ).toHaveValue("660000");
    await userEvent.click(within(dialog).getByRole("button", { name: "Gán và lập phiếu thu" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`${DETAIL}/assignment`, {
        customerId: CUSTOMER_ID,
        lines: [{ installmentId: "exact-1", amount: 660_000 }],
        note: "",
      }),
    );
  });

  it("không nhận ra khách: BE lọc đợt đã đến hạn còn nợ đúng số tiền (owing + outstanding), nói khi còn đợt khác", async () => {
    const exact = {
      ...installment,
      installmentId: "exact-2",
      outstanding: 660_000,
      customerName: "Công ty Trà Xanh",
    };
    const { get } = mockApi("ACCOUNTANT", {
      get: {
        [DETAIL]: () => ({ ...needsReview, customerId: null, installmentId: null }),
        "/installments": () => ({ ...bePage([exact]), totalElements: 60 }),
      },
    });
    renderScreen(<BankTransactionDetail id={ID} />, "ACCOUNTANT");
    const block = await screen.findByRole("region", { name: "Đợt có thể khớp" });
    expect(await within(block).findByText(/Công ty Trà Xanh/)).toBeInTheDocument();
    expect(within(block).getByText(/Hiện 1 \/ 60 đợt khớp số tiền/)).toBeInTheDocument();
    const call = get.mock.calls.find((c) => c[0] === "/installments");
    expect(paramsOf(call)?.get("owing")).toBe("true");
    expect(paramsOf(call)?.get("outstanding")).toBe("660000");
    expect(paramsOf(call)?.has("customerId")).toBe(false);
  });

  it("BE chưa lọc theo số tiền (trước PR #497): FE vẫn chỉ giữ đợt đúng số tiền, không nói 'còn đợt khác'", async () => {
    const exact = { ...installment, installmentId: "exact-3", outstanding: 660_000 };
    mockApi("ACCOUNTANT", {
      get: {
        [DETAIL]: () => ({ ...needsReview, customerId: null, installmentId: null }),
        "/installments": () => ({ ...bePage([installment, exact]), totalElements: 350 }),
      },
    });
    renderScreen(<BankTransactionDetail id={ID} />, "ACCOUNTANT");
    const block = await screen.findByRole("region", { name: "Đợt có thể khớp" });
    expect(
      await within(block).findByRole("button", { name: "Gắn vào HD-20261126-0001-1 đợt 2" }),
    ).toBeInTheDocument();
    expect(within(block).getAllByRole("button", { name: /^Gắn vào/ })).toHaveLength(1);
    expect(within(block).queryByText(/đợt khớp số tiền/)).not.toBeInTheDocument();
  });

  it("matchingInstallments chỉ giữ đợt còn nhận tiền đúng bằng số tiền", () => {
    expect(
      matchingInstallments(
        [
          { ...installment, outstanding: 660_000 },
          { ...installment, installmentId: "p", status: "PAID", outstanding: 660_000 },
          { ...installment, installmentId: "o", outstanding: 1 },
        ],
        660_000,
      ).map((row) => row.installmentId),
    ).toEqual([INSTALLMENT_ID]);
  });
});

describe("bo-27: hộp thoại gán vào đợt", () => {
  it("ô khách không mang câu 'chỉ khách đã kích hoạt portal' của form báo giá", async () => {
    mockApi("ACCOUNTANT", {
      get: {
        [DETAIL]: () => ({ ...needsReview, customerId: null, installmentId: null }),
        "/installments": () => bePage([]),
      },
    });
    renderScreen(<BankTransactionDetail id={ID} />, "ACCOUNTANT");
    await userEvent.click(await screen.findByRole("button", { name: /^Gán vào đợt$/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByText(/kích hoạt portal/)).not.toBeInTheDocument();
  });

  it("khách nhiều đợt: tìm theo số hợp đồng / số đơn; đợt khớp số tiền lên đầu, có nhãn", async () => {
    const rows = Array.from({ length: 6 }, (_, i) => ({
      ...installment,
      installmentId: `i-${i}`,
      contractNumber: `HD-0000${i}`,
      orderNumber: `SO-0000${i}`,
      seq: 1,
      outstanding: i === 4 ? 660_000 : 100_000,
    }));
    mockApi("ACCOUNTANT", {
      get: {
        [DETAIL]: () => ({ ...needsReview, installmentId: null }),
        "/installments": () => bePage(rows),
        [`/customers/${CUSTOMER_ID}`]: () => ({
          customerId: CUSTOMER_ID,
          name: "Công ty Ly Giấy Xanh",
        }),
      },
    });
    renderScreen(<BankTransactionDetail id={ID} />, "ACCOUNTANT");
    await userEvent.click(await screen.findByRole("button", { name: /^Gán vào đợt$/ }));
    const dialog = await screen.findByRole("dialog");
    const boxes = await within(dialog).findAllByRole("checkbox");
    expect(boxes[0]).toHaveAccessibleName("Gán HD-00004 đợt 1");
    expect(within(dialog).getByText("Khớp số tiền")).toBeInTheDocument();
    await userEvent.type(
      within(dialog).getByRole("searchbox", { name: /Tìm đợt theo số hợp đồng/ }),
      "SO-00002",
    );
    expect(within(dialog).getAllByRole("checkbox")).toHaveLength(1);
    expect(within(dialog).getByRole("checkbox")).toHaveAccessibleName("Gán HD-00002 đợt 1");
  });
  it("chưa chọn khách: tìm đợt theo số hợp đồng trên mọi khách; 'Chọn' lấy khách của đợt và tick sẵn đợt", async () => {
    const found = {
      ...installment,
      installmentId: "found-1",
      contractNumber: "HD-20261120-0009-1",
      orderNumber: "SO-0009",
      seq: 1,
      outstanding: 500_000,
      customerName: "Công ty Trà Xanh",
    };
    const { get, post } = mockApi("ACCOUNTANT", {
      get: {
        [DETAIL]: () => ({ ...needsReview, customerId: null, installmentId: null }),
        "/installments": (params) => {
          const query = params as URLSearchParams;
          if (query.has("search")) return bePage([found]);
          if (query.get("customerId") === CUSTOMER_ID) return bePage([found]);
          return bePage([]);
        },
        [`/customers/${CUSTOMER_ID}`]: () => ({
          customerId: CUSTOMER_ID,
          name: "Công ty Trà Xanh",
        }),
      },
      post: { [`${DETAIL}/assignment`]: () => ({ ...needsReview, status: "APPLIED" }) },
    });
    renderScreen(<BankTransactionDetail id={ID} />, "ACCOUNTANT");
    await userEvent.click(await screen.findByRole("button", { name: /^Gán vào đợt$/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(
      within(dialog).getByRole("searchbox", { name: /Tìm đợt theo số hợp đồng, số đơn/ }),
      "HD-20261120",
    );
    await userEvent.click(
      await within(dialog).findByRole("button", { name: "Chọn HD-20261120-0009-1 đợt 1" }),
    );
    const search = get.mock.calls.find(
      (c) => c[0] === "/installments" && paramsOf(c)?.has("search"),
    );
    expect(paramsOf(search)?.get("search")).toBe("HD-20261120");
    expect(
      await within(dialog).findByLabelText(/Số tiền gán HD-20261120-0009-1 đợt 1/),
    ).toHaveValue("500000");
    await userEvent.click(within(dialog).getByRole("button", { name: "Gán và lập phiếu thu" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`${DETAIL}/assignment`, {
        customerId: CUSTOMER_ID,
        lines: [{ installmentId: "found-1", amount: 500_000 }],
        note: "",
      }),
    );
  });
});
