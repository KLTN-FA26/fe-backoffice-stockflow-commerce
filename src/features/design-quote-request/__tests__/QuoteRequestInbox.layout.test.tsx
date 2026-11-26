import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { bePage, mockApi, renderScreen } from "@/test/api-screen";
import "@/test/jsdom-popover";

import { DesignQuoteRequestList } from "..";
import { primaryQuoteRequestAction, quoteRequestActions } from "../lifecycle";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

const DESIGN_ID = "0d000000-0000-7000-8000-000000000001";
const QUOTE_ID = "0z000000-0000-7000-8000-000000000001";

function request(overrides: Record<string, unknown> = {}) {
  return {
    id: "0q000000-0000-7000-8000-000000000001",
    designId: DESIGN_ID,
    designName: "Túi giấy kraft",
    designStatus: "APPROVED",
    customerId: "0c000000-0000-7000-8000-000000000009",
    customerName: "Cửa hàng Trà Sen",
    sku: "BAG-KRAFT-M",
    customerSku: "TRASEN-BAG-01",
    cartons: 50,
    status: "OPEN",
    requestedBy: "0c000000-0000-7000-8000-000000000009",
    requestedAt: "2026-11-19T03:00:00Z",
    ...overrides,
  };
}

const headers = () => screen.getAllByRole("columnheader").map((cell) => cell.textContent);

describe("Hộp yêu cầu báo giá — bố cục 1366px (BO-UX-10/11, L-2, L-5)", () => {
  it("ẩn mặc định Trạng thái thiết kế, SKU phôi, Lý do trả lại; bật lại qua Chọn cột hiển thị, chip x/y", async () => {
    mockApi("SALES_STAFF", { get: { "/design-quote-requests": () => bePage([request()]) } });
    renderScreen(<DesignQuoteRequestList />, "SALES_STAFF");
    await screen.findByText("Cửa hàng Trà Sen");
    expect(headers()).not.toContain("Trạng thái thiết kế");
    expect(headers()).not.toContain("SKU phôi");
    expect(headers()).not.toContain("Lý do trả lại");
    // Bộ cột mặc định (7/10) chưa phải "đã đổi" → chưa có chip
    expect(screen.queryByText("Cột hiển thị: 7/10")).not.toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Chọn cột hiển thị" }));
    await user.click(await screen.findByRole("option", { name: "SKU phôi" }));
    await waitFor(() => expect(headers()).toContain("SKU phôi"));
    expect(screen.getByText("Cột hiển thị: 8/10")).toBeInTheDocument();
    expect(localStorage.getItem("stockflow:admin:design-quote-requests:columns")).toContain("sku");
  });

  it("cột thao tác ghim phải; tên thiết kế là link tới trang thiết kế", async () => {
    mockApi("SALES_STAFF", { get: { "/design-quote-requests": () => bePage([request()]) } });
    renderScreen(<DesignQuoteRequestList />, "SALES_STAFF");
    const link = await screen.findByRole("link", { name: "Túi giấy kraft" });
    expect(link).toHaveAttribute("href", `/admin/designs/review-queue/${DESIGN_ID}`);
    const actionsHeader = screen.getByRole("columnheader", { name: "Hành động" });
    expect(actionsHeader.className).toContain("sticky");
    const cell = screen.getByRole("button", { name: "Lập báo giá — Túi giấy kraft" }).closest("td");
    expect(cell?.className).toContain("right-0");
  });

  it("lý do trả lại thành icon có tên truy cập trên ô trạng thái", async () => {
    mockApi("SALES_STAFF", {
      get: {
        "/design-quote-requests": () =>
          bePage([request({ designStatus: "DRAFT", returnReason: "Thiếu tràn lề 3mm" })]),
      },
    });
    renderScreen(<DesignQuoteRequestList />, "SALES_STAFF");
    expect(
      await screen.findByRole("button", {
        name: "Lý do trả lại — Túi giấy kraft: Thiếu tràn lề 3mm",
      }),
    ).toBeInTheDocument();
  });

  it("R5-5: đóng vì đã báo giá → 'Đã báo giá QT-…' dẫn tới báo giá; vắng trường → 'Đã đóng'", async () => {
    mockApi("SALES_STAFF", {
      get: {
        "/design-quote-requests": () =>
          bePage([
            request({
              status: "CLOSED",
              closedOutcome: "QUOTED",
              quoteId: QUOTE_ID,
              quoteNumber: "QT-20261123-0001",
            }),
            request({
              id: "0q000000-0000-7000-8000-000000000002",
              status: "CLOSED",
              designName: "Ly",
            }),
          ]),
      },
    });
    renderScreen(<DesignQuoteRequestList />, "SALES_STAFF", "?status=ALL");
    const link = await screen.findByRole("link", { name: /Đã báo giá QT-20261123-0001/ });
    expect(link).toHaveAttribute("href", `/admin/quotes/${QUOTE_ID}`);
    const other = screen.getByRole("link", { name: "Ly" }).closest("tr");
    expect(within(other as HTMLElement).getByText("Đã đóng")).toBeInTheDocument();
  });

  it("ô khách là bộ lọc tuỳ chọn: không dấu *, không câu luật kích hoạt portal (L-5)", async () => {
    mockApi("SALES_STAFF", { get: { "/design-quote-requests": () => bePage([request()]) } });
    renderScreen(<DesignQuoteRequestList />, "SALES_STAFF");
    await screen.findByText("Cửa hàng Trà Sen");
    expect(screen.queryByText(/kích hoạt portal/)).toBeNull();
    expect(screen.queryByText("(bắt buộc)")).toBeNull();
  });

  it("nút chính: Lập báo giá khi lập được, Mở chat khi bị chặn", () => {
    const all = () => true;
    const ready = quoteRequestActions(request() as never, all);
    expect(primaryQuoteRequestAction(ready)?.id).toBe("create-quote");
    const blocked = quoteRequestActions(request({ customerSku: undefined }) as never, all);
    expect(primaryQuoteRequestAction(blocked)?.id).toBe("open-chat");
  });
});
