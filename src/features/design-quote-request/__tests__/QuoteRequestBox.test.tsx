import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { toast } from "@/components/shared/Toast";
import { apiError, bePage, mockApi, renderScreen } from "@/test/api-screen";

import { DesignQuoteRequestList, ProjectQuoteRequestList } from "..";
import { quoteRequestActions } from "../lifecycle";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  vi.restoreAllMocks();
  push.mockReset();
});

const REQUEST_ID = "0q000000-0000-7000-8000-000000000001";
const DESIGN_ID = "0d000000-0000-7000-8000-000000000001";
const PROJECT_ID = "0p000000-0000-7000-8000-000000000001";
const CUSTOMER_ID = "0c000000-0000-7000-8000-000000000009";
const CONVERSATION_ID = "0v000000-0000-7000-8000-000000000001";
const QUOTE_ID = "0z000000-0000-7000-8000-000000000001";
const PROJECT_REQUEST_ID = "0q000000-0000-7000-8000-000000000002";

/** Yêu cầu của túi giấy 50 thùng; trường null đã bị BE bỏ. */
function request(overrides: Record<string, unknown> = {}) {
  return {
    id: REQUEST_ID,
    designId: DESIGN_ID,
    designName: "Túi giấy kraft",
    designStatus: "APPROVED",
    customerId: CUSTOMER_ID,
    customerName: "Cửa hàng Trà Sen",
    sku: "BAG-KRAFT-M",
    customerSku: "TRASEN-BAG-01",
    cartons: 50,
    desiredDeliveryDate: "2026-12-20",
    status: "OPEN",
    requestedBy: CUSTOMER_ID,
    requestedAt: "2026-11-19T03:00:00Z",
    ...overrides,
  };
}

function projectRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: "0q000000-0000-7000-8000-000000000002",
    projectId: PROJECT_ID,
    projectName: "Bộ ly Tết",
    customerId: CUSTOMER_ID,
    customerName: "Cửa hàng Trà Sen",
    requestedBy: CUSTOMER_ID,
    requestedAt: "2026-11-19T03:00:00Z",
    status: "OPEN",
    lines: [
      {
        designId: DESIGN_ID,
        designName: "Ly A",
        designStatus: "APPROVED",
        customerSku: "TRASEN-CUP-01",
        cartons: 10,
      },
    ],
    ...overrides,
  };
}

const CONVERSATIONS = "/chat/conversations";
const closureUrl = `/design-quote-requests/${REQUEST_ID}/closure`;

type Params = Record<string, unknown> | undefined;
const callsTo = (spy: ReturnType<typeof mockApi>["get"], url: string) =>
  spy.mock.calls.filter((call) => call[0] === url);

describe("Hộp yêu cầu báo giá thiết kế", () => {
  it("mặc định gọi status=OPEN, page=0", async () => {
    const api = mockApi("SALES_STAFF", {
      get: { "/design-quote-requests": () => bePage([request()]) },
    });
    renderScreen(<DesignQuoteRequestList />, "SALES_STAFF");
    expect(await screen.findByText("Túi giấy kraft")).toBeInTheDocument();
    const params = callsTo(api.get, "/design-quote-requests")[0]?.[1] as { params: Params };
    expect(params.params).toMatchObject({ status: "OPEN", page: 0 });
    expect(screen.getByText("TRASEN-BAG-01")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
  });

  it("Đóng gọi POST …/closure rồi tải lại; nút ẩn khi CLOSED", async () => {
    vi.spyOn(toast, "success").mockImplementation(() => undefined);
    let rows = [request()];
    const api = mockApi("SALES_STAFF", {
      get: { "/design-quote-requests": () => bePage(rows) },
      post: {
        [closureUrl]: () => {
          rows = [request({ status: "CLOSED" })];
          return null;
        },
      },
    });
    renderScreen(<DesignQuoteRequestList />, "SALES_STAFF");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Đóng" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Đóng" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(closureUrl));
    await waitFor(() => expect(callsTo(api.get, "/design-quote-requests")).toHaveLength(2));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Đóng" })).toBeNull());
  });

  it("thiếu quyền UPDATE hoặc đã CLOSED thì không có hành động Đóng", () => {
    const all = () => true;
    const noUpdate = (code: string) => code !== "design-quote-requests:UPDATE";
    const ids = (row: Record<string, unknown>, can: (code: string) => boolean) =>
      quoteRequestActions(request(row) as never, can as never).map((action) => action.id);
    expect(ids({}, all)).toContain("close");
    expect(ids({}, noUpdate)).not.toContain("close");
    expect(ids({ status: "CLOSED" }, all)).not.toContain("close");
    expect(ids({ status: "CLOSED" }, all)).not.toContain("create-quote");
  });

  it("Lập báo giá tắt khi PENDING_REVIEW với câu 'Chờ duyệt thiết kế'", async () => {
    mockApi("SALES_STAFF", {
      get: {
        "/design-quote-requests": () =>
          bePage([request({ designStatus: "PENDING_REVIEW", customerSku: undefined })]),
      },
    });
    renderScreen(<DesignQuoteRequestList />, "SALES_STAFF");
    expect(await screen.findByRole("button", { name: "Lập báo giá" })).toBeDisabled();
    const hints = quoteRequestActions(
      request({ designStatus: "PENDING_REVIEW" }) as never,
      () => true,
    );
    expect(hints.find((action) => action.id === "create-quote")?.hint).toBe("Chờ duyệt thiết kế");
  });

  it("Mở chat: tìm GET /chat/conversations?contextKind=DESIGN&contextId=… rồi chuyển /admin/chat/{id}", async () => {
    const api = mockApi("SALES_STAFF", {
      get: {
        "/design-quote-requests": () => bePage([request()]),
        [CONVERSATIONS]: () => bePage([{ id: CONVERSATION_ID }]),
      },
    });
    renderScreen(<DesignQuoteRequestList />, "SALES_STAFF");
    await userEvent.setup().click(await screen.findByRole("button", { name: "Mở chat" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/admin/chat/${CONVERSATION_ID}`));
    const query = (callsTo(api.get, CONVERSATIONS)[0]?.[1] as { params: URLSearchParams }).params;
    expect(query.get("contextKind")).toBe("DESIGN");
    expect(query.get("contextId")).toBe(DESIGN_ID);
    // BE bỏ hội thoại đã kết thúc nếu không gửi status: phải gửi đủ, kể cả CLOSED.
    expect(query.getAll("status")).toContain("CLOSED");
  });

  it("Mở chat khi khách chưa có hội thoại: báo, không chuyển trang", async () => {
    const info = vi.spyOn(toast, "info").mockImplementation(() => undefined);
    mockApi("SALES_STAFF", {
      get: {
        "/design-quote-requests": () => bePage([request()]),
        [CONVERSATIONS]: () => bePage([]),
      },
    });
    renderScreen(<DesignQuoteRequestList />, "SALES_STAFF");
    await userEvent.setup().click(await screen.findByRole("button", { name: "Mở chat" }));
    await waitFor(() =>
      expect(info).toHaveBeenCalledWith("Khách chưa có hội thoại về thiết kế này"),
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("Lập báo giá (đơn lẻ): POST …/quote không body, mở màn sửa báo giá, tải lại danh sách", async () => {
    const quoteUrl = `/design-quote-requests/${REQUEST_ID}/quote`;
    const api = mockApi("SALES_STAFF", {
      get: { "/design-quote-requests": () => bePage([request()]) },
      post: { [quoteUrl]: () => ({ id: QUOTE_ID, quoteNumber: "Q-1", status: "DRAFT" }) },
    });
    renderScreen(<DesignQuoteRequestList />, "SALES_STAFF");
    await userEvent.setup().click(await screen.findByRole("button", { name: "Lập báo giá" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/admin/quotes/${QUOTE_ID}/edit`));
    expect(api.post).toHaveBeenCalledWith(quoteUrl);
    // Không còn tìm hội thoại chat để lập báo giá.
    expect(callsTo(api.get, CONVERSATIONS)).toHaveLength(0);
    await waitFor(() => expect(callsTo(api.get, "/design-quote-requests")).toHaveLength(2));
  });

  it("Lập báo giá (dự án): POST …/quote của API dự án rồi mở màn sửa báo giá", async () => {
    const quoteUrl = `/design-project-quote-requests/${PROJECT_REQUEST_ID}/quote`;
    const api = mockApi("SALES_STAFF", {
      get: { "/design-project-quote-requests": () => bePage([projectRequest()]) },
      post: { [quoteUrl]: () => ({ id: QUOTE_ID, status: "DRAFT" }) },
    });
    renderScreen(<ProjectQuoteRequestList />, "SALES_STAFF");
    await userEvent.setup().click(await screen.findByRole("button", { name: "Lập báo giá" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/admin/quotes/${QUOTE_ID}/edit`));
    expect(api.post).toHaveBeenCalledWith(quoteUrl);
    await waitFor(() => expect(callsTo(api.get, "/design-project-quote-requests")).toHaveLength(2));
  });

  it("Lập báo giá: yêu cầu đã trả lời từ trước, báo giá không còn nháp → mở trang chi tiết", async () => {
    mockApi("SALES_STAFF", {
      get: { "/design-quote-requests": () => bePage([request()]) },
      post: {
        [`/design-quote-requests/${REQUEST_ID}/quote`]: () => ({ id: QUOTE_ID, status: "SENT" }),
      },
    });
    renderScreen(<DesignQuoteRequestList />, "SALES_STAFF");
    await userEvent.setup().click(await screen.findByRole("button", { name: "Lập báo giá" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/admin/quotes/${QUOTE_ID}`));
  });

  it("Lập báo giá: nút tắt trong lúc đang gọi", async () => {
    let release: (value: { id: string; status: string }) => void = () => undefined;
    mockApi("SALES_STAFF", {
      get: { "/design-quote-requests": () => bePage([request()]) },
      post: {
        [`/design-quote-requests/${REQUEST_ID}/quote`]: () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      },
    });
    renderScreen(<DesignQuoteRequestList />, "SALES_STAFF");
    await userEvent.setup().click(await screen.findByRole("button", { name: "Lập báo giá" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Lập báo giá" })).toBeDisabled());
    release({ id: QUOTE_ID, status: "DRAFT" });
    await waitFor(() => expect(push).toHaveBeenCalled());
  });

  it.each([
    [
      "DESIGN_NOT_APPROVED",
      "Thiết kế chưa được duyệt hoặc chưa có SKU riêng — chưa lập báo giá được.",
    ],
    ["DESIGN_QUOTE_REQUEST_CLOSED", "Yêu cầu đã được đóng mà không lập báo giá."],
  ])("Lập báo giá: 409 %s hiện câu riêng, không chuyển trang", async (code, message) => {
    const error = vi.spyOn(toast, "error").mockImplementation(() => undefined);
    mockApi("SALES_STAFF", {
      get: { "/design-quote-requests": () => bePage([request()]) },
      post: {
        [`/design-quote-requests/${REQUEST_ID}/quote`]: () => {
          throw apiError(409, code, undefined, "Message tiếng Anh của BE");
        },
      },
    });
    renderScreen(<DesignQuoteRequestList />, "SALES_STAFF");
    await userEvent.setup().click(await screen.findByRole("button", { name: "Lập báo giá" }));
    await waitFor(() => expect(error).toHaveBeenCalledWith(message));
    expect(push).not.toHaveBeenCalled();
  });

  it("Lập báo giá: 404 dùng câu không tìm thấy chung", async () => {
    const error = vi.spyOn(toast, "error").mockImplementation(() => undefined);
    mockApi("SALES_STAFF", {
      get: { "/design-quote-requests": () => bePage([request()]) },
      post: {
        [`/design-quote-requests/${REQUEST_ID}/quote`]: () => {
          throw apiError(404, "NOT_FOUND");
        },
      },
    });
    renderScreen(<DesignQuoteRequestList />, "SALES_STAFF");
    await userEvent.setup().click(await screen.findByRole("button", { name: "Lập báo giá" }));
    await waitFor(() => expect(error).toHaveBeenCalledWith("Không tìm thấy bản ghi."));
    expect(push).not.toHaveBeenCalled();
  });

  it("Lập báo giá: 403 dùng câu quyền chung", async () => {
    const error = vi.spyOn(toast, "error").mockImplementation(() => undefined);
    mockApi("SALES_STAFF", {
      get: { "/design-quote-requests": () => bePage([request()]) },
      post: {
        [`/design-quote-requests/${REQUEST_ID}/quote`]: () => {
          throw apiError(403, "FORBIDDEN");
        },
      },
    });
    renderScreen(<DesignQuoteRequestList />, "SALES_STAFF");
    await userEvent.setup().click(await screen.findByRole("button", { name: "Lập báo giá" }));
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith("Bạn không có quyền thực hiện thao tác này."),
    );
  });

  it("?status=CLOSED gửi status=CLOSED; ?status=ALL bỏ status; ?page=2 gọi page=1", async () => {
    const api = mockApi("SALES_STAFF", {
      get: { "/design-quote-requests": () => bePage([request({ status: "CLOSED" })]) },
    });
    const sent = () =>
      callsTo(api.get, "/design-quote-requests").map((c) => (c[1] as { params: Params }).params);
    const closed = renderScreen(<DesignQuoteRequestList />, "SALES_STAFF", "?status=CLOSED");
    await screen.findByText("Túi giấy kraft");
    expect(sent()[0]).toMatchObject({ status: "CLOSED", page: 0 });
    closed.unmount();
    api.get.mockClear();
    const all = renderScreen(<DesignQuoteRequestList />, "SALES_STAFF", "?status=ALL");
    await screen.findByText("Túi giấy kraft");
    expect(sent()[0]).not.toHaveProperty("status");
    all.unmount();
    api.get.mockClear();
    renderScreen(<DesignQuoteRequestList />, "SALES_STAFF", "?page=2");
    await screen.findByText("Túi giấy kraft");
    expect(sent()[0]).toMatchObject({ status: "OPEN", page: 1 });
  });

  it("đổi trạng thái về trang đầu", async () => {
    const api = mockApi("SALES_STAFF", {
      get: { "/design-quote-requests": () => bePage([request()]) },
    });
    renderScreen(<DesignQuoteRequestList />, "SALES_STAFF", "?page=3");
    await screen.findByText("Túi giấy kraft");
    // Radix Select cần các hàm con trỏ mà jsdom không có.
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.releasePointerCapture = () => undefined;
    Element.prototype.scrollIntoView = () => undefined;
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: /Trạng thái/ }));
    await user.click(await screen.findByRole("option", { name: "Đã đóng" }));
    await waitFor(() => {
      const last = callsTo(api.get, "/design-quote-requests").at(-1)?.[1] as { params: Params };
      expect(last.params).toMatchObject({ status: "CLOSED", page: 0 });
    });
  });

  it("API dự án gửi status=OPEN mặc định, bỏ status khi ?status=ALL", async () => {
    const api = mockApi("SALES_STAFF", {
      get: { "/design-project-quote-requests": () => bePage([projectRequest()]) },
    });
    const sent = () =>
      callsTo(api.get, "/design-project-quote-requests").map(
        (c) => (c[1] as { params: Params }).params,
      );
    const open = renderScreen(<ProjectQuoteRequestList />, "SALES_STAFF");
    expect(await screen.findByText("Bộ ly Tết")).toBeInTheDocument();
    expect(sent()[0]).toEqual({ page: 0, size: expect.any(Number), status: "OPEN" });
    expect(screen.getByText(/TRASEN-CUP-01/)).toBeInTheDocument();
    open.unmount();
    api.get.mockClear();
    renderScreen(<ProjectQuoteRequestList />, "SALES_STAFF", "?status=ALL");
    await screen.findByText("Bộ ly Tết");
    expect(sent()[0]).toEqual({ page: 0, size: expect.any(Number) });
  });

  it("dự án: chọn 'Đã đóng' gửi status=CLOSED và về trang đầu", async () => {
    const api = mockApi("SALES_STAFF", {
      get: { "/design-project-quote-requests": () => bePage([projectRequest()]) },
    });
    renderScreen(<ProjectQuoteRequestList />, "SALES_STAFF", "?page=3");
    await screen.findByText("Bộ ly Tết");
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.releasePointerCapture = () => undefined;
    Element.prototype.scrollIntoView = () => undefined;
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: /Trạng thái/ }));
    await user.click(await screen.findByRole("option", { name: "Đã đóng" }));
    await waitFor(() => {
      const last = callsTo(api.get, "/design-project-quote-requests").at(-1)?.[1] as {
        params: Params;
      };
      expect(last.params).toMatchObject({ status: "CLOSED", page: 0 });
    });
  });

  it("dự án: một dòng chưa có SKU riêng thì Lập báo giá tắt", () => {
    const row = projectRequest({
      lines: [{ designId: DESIGN_ID, designName: "Ly A", designStatus: "APPROVED", cartons: 10 }],
    });
    const action = quoteRequestActions(row as never, () => true).find(
      (item) => item.id === "create-quote",
    );
    expect(action?.enabled).toBe(false);
  });
});
