import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { bePage, mockApi, renderScreen } from "@/test/api-screen";

import { QuoteList } from "..";
import { CUSTOMER, CUSTOMER_ID, QUOTE_ROW } from "../__fixtures__/quote-ds02";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

const headers = () => screen.getAllByRole("columnheader").map((cell) => cell.textContent);
const customer = { [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER };

describe("Danh sách báo giá — giá trị và hiệu lực (BO-UX-12, BO-UX-13)", () => {
  it("R5-2: có `total` → cột 'Tổng có thuế' căn phải; dòng chưa đủ giá ghi 'Chưa đủ giá'", async () => {
    mockApi("SALES_STAFF", {
      get: {
        "/quotes": () =>
          bePage([
            { ...QUOTE_ROW, total: 28_620_000, lineCount: 3, firstItemName: "Ly giấy 12oz" },
            { ...QUOTE_ROW, id: "q-2", quoteNumber: "QT-20261120-9002", status: "DRAFT" },
          ]),
        ...customer,
      },
    });
    renderScreen(<QuoteList />, "SALES_STAFF");
    await screen.findByText("QT-20261120-9002");
    expect(headers()).toContain("Tổng có thuế");
    expect(headers()).not.toContain("Bản");
    expect(screen.getByText(/28\.620\.000/)).toBeInTheDocument();
    expect(screen.getByText("Chưa đủ giá")).toBeInTheDocument();
    expect(screen.getByText("Ly giấy 12oz +2 dòng")).toBeInTheDocument();
  });

  it("BE chưa trả `total` → không có cột 'Tổng có thuế'; bản > 1 gộp vào số báo giá", async () => {
    mockApi("SALES_STAFF", {
      get: { "/quotes": () => bePage([{ ...QUOTE_ROW, revision: 2 }]), ...customer },
    });
    renderScreen(<QuoteList />, "SALES_STAFF");
    const link = await screen.findByRole("link", { name: /QT-20261120-9001/ });
    expect(link).toHaveTextContent("QT-20261120-9001 · b2");
    expect(headers()).not.toContain("Tổng có thuế");
  });

  it("đã gửi mà quá hạn hiệu lực ghi chữ 'Hết hiệu lực' (không chỉ đổi màu)", async () => {
    mockApi("SALES_STAFF", {
      get: {
        "/quotes": () =>
          bePage([
            {
              ...QUOTE_ROW,
              status: "SENT",
              convertedOrderId: undefined,
              validUntil: "2020-01-01T00:00:00Z",
            },
            {
              ...QUOTE_ROW,
              id: "q-2",
              quoteNumber: "QT-20261120-9002",
              status: "SENT",
              convertedOrderId: undefined,
            },
          ]),
        ...customer,
      },
    });
    renderScreen(<QuoteList />, "SALES_STAFF");
    const expiredRow = (await screen.findByRole("link", { name: /QT-20261120-9001/ })).closest(
      "tr",
    );
    expect(within(expiredRow as HTMLElement).getByText("Hết hiệu lực")).toBeInTheDocument();
    const validRow = screen.getByRole("link", { name: /QT-20261120-9002/ }).closest("tr");
    expect(within(validRow as HTMLElement).queryByText("Hết hiệu lực")).toBeNull();
  });
});

describe("Danh sách báo giá — menu ⋯ của dòng (backoffice-erp-ui A6)", () => {
  const rows = [
    { ...QUOTE_ROW, id: "q-1", quoteNumber: "QT-1", status: "DRAFT", convertedOrderId: null },
    { ...QUOTE_ROW, id: "q-2", quoteNumber: "QT-2", status: "CONVERTED", convertedOrderId: "o-9" },
  ];
  const menuOf = async (quoteNumber: string) => {
    mockApi("SALES_STAFF", { get: { "/quotes": () => bePage(rows), ...customer } });
    renderScreen(<QuoteList />, "SALES_STAFF");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: `Thao tác — ${quoteNumber}` }));
    return screen.findByRole("dialog");
  };

  it("nháp → chỉ 'Xem chi tiết' (sửa làm ở chi tiết: dòng không có cờ legacy)", async () => {
    const menu = await menuOf("QT-1");
    expect(within(menu).getByRole("link", { name: /Xem chi tiết/ })).toHaveAttribute(
      "href",
      "/admin/quotes/q-1",
    );
    expect(within(menu).queryByRole("link", { name: /Sửa/ })).toBeNull();
  });

  it("lọc cột 'Đơn đã tạo' = Đã tạo đơn → chỉ còn dòng đã có đơn (lọc trang đang xem)", async () => {
    mockApi("SALES_STAFF", { get: { "/quotes": () => bePage(rows), ...customer } });
    renderScreen(<QuoteList />, "SALES_STAFF");
    await screen.findByText("QT-1");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Lọc đơn đã tạo" }));
    await user.click(await screen.findByRole("option", { name: /Đã tạo đơn/ }));
    await waitFor(() => expect(screen.queryByText("QT-1")).not.toBeInTheDocument());
    expect(screen.getByText("QT-2")).toBeInTheDocument();
  });

  it("đã tạo đơn → có 'Mở đơn' tới đơn hàng", async () => {
    const menu = await menuOf("QT-2");
    expect(within(menu).getByRole("link", { name: /Mở đơn/ })).toHaveAttribute(
      "href",
      "/admin/orders/o-9",
    );
  });
});

describe("Danh sách báo giá — tên kèm id (#286)", () => {
  const customerCalls = (get: ReturnType<typeof mockApi>["get"]) =>
    get.mock.calls.filter(([url]) => String(url).startsWith("/customers"));

  it("tên khách + số đơn lấy từ dòng BE → không gọi GET /customers/{id} cho từng dòng", async () => {
    const rows = [
      {
        ...QUOTE_ROW,
        customerName: "Khách hàng demo",
        customerCode: "0399990001",
        convertedOrderNumber: "SO-20261120-900001",
      },
      {
        ...QUOTE_ROW,
        id: "q-2",
        quoteNumber: "QT-2",
        customerId: "d0938090-20ac-ae0d-e6ce-aae90663ac33",
        customerName: "Công ty CP Trà Sữa Mây",
        status: "DRAFT",
        convertedOrderId: null,
      },
    ];
    // Không mock `/customers/...` — gọi tới là ném lỗi
    const api = mockApi("SALES_STAFF", { get: { "/quotes": () => bePage(rows) } });
    renderScreen(<QuoteList />, "SALES_STAFF");
    const first = (await screen.findByRole("link", { name: /QT-20261120-9001/ })).closest("tr");
    const second = screen.getByRole("link", { name: /QT-2$/ }).closest("tr");
    expect(
      within(first as HTMLElement).getByRole("link", { name: "Khách hàng demo" }),
    ).toBeInTheDocument();
    expect(within(second as HTMLElement).getByText("Công ty CP Trà Sữa Mây")).toBeInTheDocument();
    expect(
      within(first as HTMLElement).getByRole("link", { name: "SO-20261120-900001" }),
    ).toHaveAttribute("href", `/admin/orders/${QUOTE_ROW.convertedOrderId}`);
    expect(customerCalls(api.get)).toHaveLength(0);
  });

  it("BE thiếu tên → mã khách, thiếu cả mã → nhãn trung tính; vẫn không tra khách, không UUID", async () => {
    const rows = [
      { ...QUOTE_ROW, customerCode: "0399990001" },
      { ...QUOTE_ROW, id: "q-2", quoteNumber: "QT-2", convertedOrderId: null },
    ];
    const api = mockApi("SALES_STAFF", { get: { "/quotes": () => bePage(rows) } });
    renderScreen(<QuoteList />, "SALES_STAFF");
    const first = (await screen.findByRole("link", { name: /QT-20261120-9001/ })).closest("tr");
    const second = screen.getByRole("link", { name: /QT-2$/ }).closest("tr");
    expect(within(first as HTMLElement).getByText("0399990001")).toBeInTheDocument();
    expect(within(second as HTMLElement).getByText("Khách hàng")).toBeInTheDocument();
    expect(screen.queryByText(CUSTOMER_ID)).toBeNull();
    // Chưa có số đơn → link chung "Mở đơn"
    expect(within(first as HTMLElement).getByRole("link", { name: "Mở đơn" })).toBeInTheDocument();
    expect(customerCalls(api.get)).toHaveLength(0);
  });
});
