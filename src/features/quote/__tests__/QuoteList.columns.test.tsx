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

describe("Danh sách báo giá — tab nhanh và hàng chờ (bo-06, bo-14)", () => {
  const statusParams = (api: ReturnType<typeof mockApi>) =>
    api.get.mock.calls
      .filter(([url]) => url === "/quotes")
      .map((call) => {
        const params = (call[1] as { params: URLSearchParams }).params;
        return {
          status: params.getAll("status").join(","),
          priceReview: params.get("priceReview"),
        };
      });

  it("tab nhanh đổi lọc trạng thái / chờ duyệt giá trên BE", async () => {
    const user = userEvent.setup();
    const api = mockApi("SALES_STAFF", {
      get: { "/quotes": () => bePage([QUOTE_ROW]), ...customer },
    });
    renderScreen(<QuoteList />, "SALES_STAFF");
    const tabs = await screen.findByRole("tablist", { name: "Lọc nhanh theo trạng thái" });
    expect(within(tabs).getByRole("tab", { name: "Tất cả" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await user.click(within(tabs).getByRole("tab", { name: "Khách yêu cầu sửa" }));
    await waitFor(() =>
      expect(statusParams(api).at(-1)).toEqual({ status: "CHANGES_REQUESTED", priceReview: null }),
    );
    expect(within(tabs).getByRole("tab", { name: "Khách yêu cầu sửa" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await user.click(within(tabs).getByRole("tab", { name: "Chờ duyệt giá" }));
    await waitFor(() =>
      expect(statusParams(api).at(-1)).toEqual({ status: "", priceReview: "PENDING" }),
    );
  });

  it("hàng chờ duyệt giá rỗng nói 'không có gì chờ', không phải 'không khớp từ khoá'", async () => {
    mockApi("SALES_MANAGER", { get: { "/quotes": () => bePage([]), ...customer } });
    renderScreen(<QuoteList />, "SALES_MANAGER", "?priceReview=PENDING");
    expect(await screen.findByText("Không có báo giá nào chờ duyệt giá")).toBeInTheDocument();
    expect(screen.queryByText("Không tìm thấy kết quả")).toBeNull();
  });

  it("'Yêu cầu sửa' là cam 'cần xử lý', không đỏ như lỗi", async () => {
    mockApi("SALES_STAFF", {
      get: {
        "/quotes": () => bePage([{ ...QUOTE_ROW, status: "CHANGES_REQUESTED" }]),
        ...customer,
      },
    });
    renderScreen(<QuoteList />, "SALES_STAFF");
    const status = await screen.findByText("Yêu cầu sửa", { selector: "span" });
    expect(status.querySelector(".bg-dot-warning")).not.toBeNull();
    expect(status.querySelector(".bg-dot-danger")).toBeNull();
  });
});
