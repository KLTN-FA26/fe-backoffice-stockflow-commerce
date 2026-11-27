/**
 * Duyệt giá báo giá (kltn-docs 14 BR-10 sửa ngày 2026-11-26) trên màn back-office: kiểm tra giá của nháp, gửi duyệt,
 * hàng chờ, duyệt / từ chối / rút lại theo quyền (Sales, Quản lý kinh doanh, người gửi duyệt — bốn mắt), kết quả lần
 * duyệt gần nhất, và lọc "Chờ duyệt giá" của danh sách.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { bePage, mockApi, renderScreen } from "@/test/api-screen";
import { toast } from "@/components/shared/Toast";

import { QuoteDetail, QuoteList } from "..";
import {
  CUSTOMER,
  CUSTOMER_ID,
  QUOTE_ACCEPTED,
  QUOTE_ID,
  QUOTE_ROW,
  SKU,
} from "../__fixtures__/quote-ds02";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => vi.restoreAllMocks());

const detailUrl = `/quotes/${QUOTE_ID}`;
const SALES = "a1a1a1a1-0000-4000-8000-000000000005";

/** Bậc 20 thùng 1.000 đ so với giá riêng 1.250 đ: thấp hơn 20% (> 10%). */
const LINES = [
  {
    lineNo: 1,
    sku: SKU,
    cartons: 60,
    needsApproval: true,
    tiers: [
      {
        minQuantity: 20,
        unitPrice: 1000,
        referencePrice: 1250,
        source: "CUSTOMER_PRICE",
        discountPercent: 20,
        needsApproval: true,
      },
      {
        minQuantity: 50,
        unitPrice: 1200,
        referencePrice: 1150,
        source: "STANDARD_PRICE",
        discountPercent: -4.35,
        needsApproval: false,
      },
    ],
  },
];

const DRAFT = {
  ...QUOTE_ACCEPTED,
  status: "DRAFT",
  accepted: undefined,
  sentAt: undefined,
  respondedAt: undefined,
  priceReviewPending: false,
  priceCheck: { thresholdPercent: 10, needsApproval: true, lines: LINES },
};

const review = (over: Record<string, unknown> = {}) => ({
  id: "b0b0b0b0-0000-4000-8000-000000000001",
  revision: 1,
  outcome: "PENDING",
  thresholdPercent: 10,
  submittedAt: "2099-11-12T05:00:00Z",
  submittedBy: SALES,
  submittedByName: "Trần Văn Sales",
  lines: LINES,
  ...over,
});

const PENDING = { ...DRAFT, priceReviewPending: true, priceReview: review() };

function renderDetail(
  role: "SALES_STAFF" | "SALES_MANAGER",
  quote: unknown,
  post: Record<string, (params: unknown, body?: unknown) => unknown> = {},
) {
  const api = mockApi(role, {
    get: { [detailUrl]: () => quote, [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER },
    post,
  });
  renderScreen(<QuoteDetail id={QUOTE_ID} />, role);
  return api;
}

/** Mở menu "⋯" trên header báo giá (luôn có — ít nhất "Tải PDF"). */
async function openMoreActions() {
  await userEvent.click(await screen.findByRole("button", { name: "Thao tác khác với báo giá" }));
  await screen.findByRole("button", { name: "Tải PDF" });
}

describe("nháp: kiểm tra giá trước khi gửi", () => {
  it("bảng bậc giá ghi giá tham chiếu, nguồn, phần trăm thấp hơn; gửi sẽ chuyển Quản lý kinh doanh duyệt", async () => {
    const success = vi.spyOn(toast, "success");
    const api = renderDetail("SALES_STAFF", DRAFT, {
      [`${detailUrl}/sending`]: () => ({ ...PENDING, version: 3 }),
    });
    const table = await screen.findByRole("table", { name: "Bậc giá so với giá tham chiếu" });
    expect(within(table).getByText("Giá riêng của khách")).toBeInTheDocument();
    expect(within(table).getByText("Giá chuẩn")).toBeInTheDocument();
    expect(within(table).getByText("20%")).toBeInTheDocument();
    expect(within(table).getByText("cao hơn 4,35%")).toBeInTheDocument();
    expect(within(table).getByText("Cần duyệt")).toBeInTheDocument();
    expect(
      screen.getByText(/khi gửi, báo giá sẽ chuyển Quản lý kinh doanh duyệt giá/),
    ).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: /Gửi duyệt giá/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Gửi Quản lý kinh doanh duyệt giá?")).toBeVisible();
    await userEvent.click(within(dialog).getByRole("button", { name: "Gửi duyệt giá" }));
    await waitFor(() =>
      expect(success).toHaveBeenCalledWith("Đã gửi Quản lý kinh doanh duyệt giá."),
    );
    expect(api.post).toHaveBeenCalledWith(`${detailUrl}/sending`, { version: 2 });
  });

  it("giá không cần duyệt → nút vẫn là 'Gửi khách', không có cảnh báo", async () => {
    renderDetail("SALES_STAFF", {
      ...DRAFT,
      priceCheck: { thresholdPercent: 10, needsApproval: false, lines: [] },
    });
    expect(await screen.findByRole("button", { name: /Gửi khách/ })).toBeInTheDocument();
    expect(screen.queryByText(/chuyển Quản lý kinh doanh duyệt giá/)).toBeNull();
  });
});

describe("'Lưu và gửi' trên form mở trang báo giá với ?send=true", () => {
  it("hộp xác nhận gửi mở sẵn khi gửi được", async () => {
    mockApi("SALES_STAFF", {
      get: { [detailUrl]: () => DRAFT, [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER },
    });
    renderScreen(<QuoteDetail id={QUOTE_ID} />, "SALES_STAFF", "?send=true");
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Gửi Quản lý kinh doanh duyệt giá?")).toBeVisible();
  });

  it("không có ?send thì không tự mở", async () => {
    renderDetail("SALES_STAFF", DRAFT);
    await screen.findByRole("button", { name: /Gửi duyệt giá/ });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("bo-09: bảng kiểm tra giá gọn khi tất cả đạt", () => {
  const passing = (lineNo: number) => ({
    lineNo,
    sku: `${SKU}-${lineNo}`,
    cartons: 60,
    needsApproval: false,
    tiers: [
      {
        minQuantity: 20,
        unitPrice: 1250,
        referencePrice: 1250,
        source: "CUSTOMER_PRICE",
        discountPercent: 0,
        needsApproval: false,
      },
    ],
  });

  it("tất cả đạt → một dòng tóm tắt, bảng mở khi bấm Xem chi tiết", async () => {
    renderDetail("SALES_STAFF", {
      ...DRAFT,
      priceCheck: { thresholdPercent: 10, needsApproval: false, lines: [1, 2, 3].map(passing) },
    });
    expect(await screen.findByText("3/3 dòng đạt giá")).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Bậc giá so với giá tham chiếu" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Xem chi tiết" }));
    expect(
      screen.getByRole("table", { name: "Bậc giá so với giá tham chiếu" }),
    ).toBeInTheDocument();
  });

  it("có dòng cần duyệt → bảng hiện ngay, dòng cần duyệt lên đầu", async () => {
    renderDetail("SALES_STAFF", {
      ...DRAFT,
      priceCheck: {
        thresholdPercent: 10,
        needsApproval: true,
        lines: [passing(1), { ...LINES[0], lineNo: 2 }],
      },
    });
    const table = await screen.findByRole("table", { name: "Bậc giá so với giá tham chiếu" });
    expect(screen.getByText(/1\/2 dòng cần Quản lý kinh doanh duyệt giá/)).toBeInTheDocument();
    const firstRow = within(table).getAllByRole("row")[1] as HTMLElement;
    expect(within(firstRow).getByText(`2. ${SKU}`)).toBeInTheDocument();
  });
});

describe("nháp chờ duyệt giá — action gating", () => {
  it("Sales: thấy 'Chờ duyệt giá', không sửa / gửi được, chỉ Rút lại (gửi kèm version)", async () => {
    const api = renderDetail("SALES_STAFF", PENDING, {
      [`${detailUrl}/price-review-withdrawal`]: () => ({ ...DRAFT, version: 3 }),
    });
    expect(await screen.findByText("Chờ duyệt giá")).toBeVisible();
    expect(screen.getByText(/Trần Văn Sales gửi duyệt lúc/)).toBeVisible();
    // Mở menu "⋯" để kiểm cả việc nằm trong menu (nút chính ở ngoài cũng vẫn thấy)
    await openMoreActions();
    expect(screen.queryByRole("link", { name: /Sửa/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Gửi khách|Gửi duyệt giá/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Duyệt giá/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /Rút lại/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Rút lại" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(`${detailUrl}/price-review-withdrawal`, {
        version: 2,
      }),
    );
  });

  it("Quản lý kinh doanh: bảng giá gửi duyệt; Duyệt giá kèm ghi chú (không bắt buộc)", async () => {
    const api = renderDetail("SALES_MANAGER", PENDING, {
      [`${detailUrl}/price-approval`]: () => ({ ...PENDING, status: "SENT", version: 3 }),
    });
    expect(await screen.findByText("Giá gửi duyệt")).toBeVisible();
    await openMoreActions();
    expect(screen.queryByRole("button", { name: /Rút lại/ })).toBeNull();
    await userEvent.keyboard("{Escape}");
    // "Duyệt giá" là nút chính (nền đậm) ngoài menu
    await userEvent.click(screen.getByRole("button", { name: /Duyệt giá/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Ghi chú cho Sales"), "Khách lớn");
    await userEvent.click(within(dialog).getByRole("button", { name: "Duyệt giá" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(`${detailUrl}/price-approval`, {
        version: 2,
        note: "Khách lớn",
      }),
    );
  });

  it("Quản lý kinh doanh: Từ chối cần lý do", async () => {
    const api = renderDetail("SALES_MANAGER", PENDING, {
      [`${detailUrl}/price-rejection`]: () => ({ ...DRAFT, version: 3 }),
    });
    await openMoreActions();
    await userEvent.click(screen.getByRole("button", { name: /Từ chối/ }));
    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Từ chối giá" });
    expect(confirm).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText(/Lý do từ chối/), "Giá thấp quá");
    await userEvent.click(confirm);
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(`${detailUrl}/price-rejection`, {
        version: 2,
        reason: "Giá thấp quá",
      }),
    );
  });

  it("bốn mắt: Quản lý kinh doanh là người gửi duyệt → không có nút duyệt / từ chối", async () => {
    renderDetail("SALES_MANAGER", { ...PENDING, priceReview: review({ submittedBy: "u-test" }) });
    expect(await screen.findByText(/Bạn là người gửi duyệt báo giá này/)).toBeVisible();
    await openMoreActions();
    expect(screen.queryByRole("button", { name: /Duyệt giá/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Từ chối/ })).toBeNull();
  });
});

describe("kết quả lần duyệt gần nhất", () => {
  it("bị từ chối: nháp hiện ai từ chối và lý do", async () => {
    renderDetail("SALES_STAFF", {
      ...DRAFT,
      priceReview: review({
        outcome: "REJECTED",
        decidedAt: "2099-11-12T08:00:00Z",
        decidedByName: "Lê Quản Lý",
        reason: "Giá thấp quá",
      }),
    });
    expect(await screen.findByText(/Giá bị Lê Quản Lý từ chối lúc/)).toBeVisible();
    expect(screen.getByText("Giá thấp quá")).toBeVisible();
  });
});

describe("danh sách báo giá", () => {
  it("dòng chờ duyệt giá có nhãn; cột 'Duyệt giá' của bảng Bộ lọc lọc priceReview=PENDING", async () => {
    const api = mockApi("SALES_MANAGER", {
      get: {
        "/quotes": () => bePage([{ ...QUOTE_ROW, status: "DRAFT", priceReviewPending: true }]),
        [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER,
      },
    });
    renderScreen(<QuoteList />, "SALES_MANAGER");
    expect(await screen.findAllByText("Chờ duyệt giá")).not.toHaveLength(0);
    const params = () =>
      api.get.mock.calls
        .filter((c) => c[0] === "/quotes")
        .map((c) => (c[1] as { params: URLSearchParams }).params.get("priceReview"));
    expect(params()).toEqual([null]);
    await userEvent.click(screen.getByRole("button", { name: /^Bộ lọc/ }));
    const panel = await screen.findByRole("region", { name: "Duyệt giá" });
    await userEvent.click(within(panel).getByRole("option", { name: /Chờ duyệt giá/ }));
    await waitFor(() => expect(params()).toContain("PENDING"));
  });
});
