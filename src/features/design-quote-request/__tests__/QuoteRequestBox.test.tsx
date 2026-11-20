import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { toast } from "@/components/shared/Toast";
import { bePage, mockApi, renderScreen } from "@/test/api-screen";

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

  it("Lập báo giá: có hội thoại đang mở → vào chat, chỉ tìm hội thoại chưa kết thúc", async () => {
    const info = vi.spyOn(toast, "info").mockImplementation(() => undefined);
    const api = mockApi("SALES_STAFF", {
      get: {
        "/design-quote-requests": () => bePage([request()]),
        [CONVERSATIONS]: () => bePage([{ id: CONVERSATION_ID }]),
      },
    });
    renderScreen(<DesignQuoteRequestList />, "SALES_STAFF");
    await userEvent.setup().click(await screen.findByRole("button", { name: "Lập báo giá" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/admin/chat/${CONVERSATION_ID}`));
    expect(info).toHaveBeenCalledWith("Bấm 'Lập báo giá' trên thẻ yêu cầu trong hội thoại");
    const query = (callsTo(api.get, CONVERSATIONS)[0]?.[1] as { params: URLSearchParams }).params;
    expect(query.getAll("status")).not.toContain("CLOSED");
    expect(query.getAll("status")).toContain("ACTIVE");
  });

  it("Lập báo giá: không có hội thoại đang mở → form báo giá tay kèm nhắc Đóng", async () => {
    const info = vi.spyOn(toast, "info").mockImplementation(() => undefined);
    mockApi("SALES_STAFF", {
      get: {
        "/design-quote-requests": () => bePage([request()]),
        [CONVERSATIONS]: () => bePage([]),
      },
    });
    renderScreen(<DesignQuoteRequestList />, "SALES_STAFF");
    await userEvent.setup().click(await screen.findByRole("button", { name: "Lập báo giá" }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(`/admin/quotes/create?customerId=${CUSTOMER_ID}`),
    );
    expect(info).toHaveBeenCalledWith("Sau khi lập báo giá, bấm 'Đóng' yêu cầu này");
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

  it("API dự án không gửi status", async () => {
    const api = mockApi("SALES_STAFF", {
      get: { "/design-project-quote-requests": () => bePage([projectRequest()]) },
    });
    renderScreen(<ProjectQuoteRequestList />, "SALES_STAFF");
    expect(await screen.findByText("Bộ ly Tết")).toBeInTheDocument();
    const call = callsTo(api.get, "/design-project-quote-requests")[0]?.[1] as { params: Params };
    expect(call.params).toEqual({ page: 0, size: expect.any(Number) });
    expect(screen.getByText(/TRASEN-CUP-01/)).toBeInTheDocument();
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
