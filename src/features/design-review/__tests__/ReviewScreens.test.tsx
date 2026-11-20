import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { toast } from "@/components/shared/Toast";
import { apiError, bePage, mockApi, renderScreen } from "@/test/api-screen";

import { DesignReviewDetail, ReviewQueueList } from "..";
import { ARTIFACTS, CUSTOMER, CUSTOMER_ID, DESIGN_ID, PENDING_DESIGN } from "./fixtures";

import type { RouteTable, TestRole } from "@/test/api-screen";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  vi.restoreAllMocks();
  push.mockReset();
});

const detailUrl = `/designs/${DESIGN_ID}`;
const reviewUrl = `${detailUrl}/reviews`;

function detailRoutes(design: unknown = PENDING_DESIGN): RouteTable {
  return {
    [detailUrl]: () => {
      if (design instanceof Error) throw design;
      return design;
    },
    [`${detailUrl}/artifacts`]: () => ARTIFACTS,
    [`${detailUrl}/history`]: () =>
      bePage([
        {
          actorId: CUSTOMER_ID,
          decision: "SUBMITTED_FOR_REVIEW",
          version: 7,
          at: "2026-11-18T03:00:00Z",
        },
      ]),
    [`${detailUrl}/quote-requests`]: () => [],
    [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER,
  };
}

function openDetail(role: TestRole, post: RouteTable = {}, design?: unknown, search = "") {
  const api = mockApi(role, { get: detailRoutes(design), post });
  renderScreen(<DesignReviewDetail id={DESIGN_ID} />, role, search);
  return api;
}

const detailGets = (api: ReturnType<typeof mockApi>) =>
  api.get.mock.calls.filter((call) => call[0] === detailUrl).length;

async function confirmApprove(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Duyệt" }));
  const dialog = await screen.findByRole("dialog");
  await user.click(within(dialog).getByRole("button", { name: "Duyệt" }));
  return dialog;
}

describe("Hàng đợi duyệt thiết kế", () => {
  it("hàng đợi gọi GET /designs/review-queue?page=0, hiện tên, link chi tiết", async () => {
    const api = mockApi("SALES_MANAGER", {
      get: {
        "/designs/review-queue": () => bePage([PENDING_DESIGN]),
        [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER,
      },
    });
    renderScreen(<ReviewQueueList />, "SALES_MANAGER");
    expect(await screen.findByRole("link", { name: "Ly giấy Tết 2027" })).toHaveAttribute(
      "href",
      `/admin/designs/review-queue/${DESIGN_ID}`,
    );
    const call = api.get.mock.calls.find((c) => c[0] === "/designs/review-queue")?.[1] as {
      params: { page: number };
    };
    expect(call.params.page).toBe(0);
    expect(screen.getByText("CUP-12OZ-WHT")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Theo dự án/ })).toBeInTheDocument();
  });

  it("hàng đợi trống: 'Không có thiết kế nào chờ duyệt'", async () => {
    mockApi("SALES_MANAGER", { get: { "/designs/review-queue": () => bePage([]) } });
    renderScreen(<ReviewQueueList />, "SALES_MANAGER");
    expect(await screen.findByText("Không có thiết kế nào chờ duyệt")).toBeInTheDocument();
  });

  it("tab 'Theo dự án' dẫn tới vòng duyệt", async () => {
    mockApi("SALES_MANAGER", { get: { "/designs/review-queue": () => bePage([]) } });
    renderScreen(<ReviewQueueList />, "SALES_MANAGER");
    await userEvent.setup().click(await screen.findByRole("tab", { name: /Theo dự án/ }));
    expect(push).toHaveBeenCalledWith("/admin/design-review-rounds");
  });

  it("SALES_STAFF (không có APPROVE) không gọi hàng đợi", async () => {
    const api = mockApi("SALES_STAFF");
    renderScreen(<ReviewQueueList />, "SALES_STAFF");
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(api.get.mock.calls.some((c) => c[0] === "/designs/review-queue")).toBe(false);
  });
});

describe("Màn quyết định", () => {
  it("duyệt gửi {version, approved:true} rồi về hàng đợi, không gọi lại GET /designs/{id}", async () => {
    const success = vi.spyOn(toast, "success").mockImplementation(() => undefined);
    const api = openDetail("SALES_MANAGER", {
      [reviewUrl]: () => ({ ...PENDING_DESIGN, status: "APPROVED", version: 8 }),
    });
    const user = userEvent.setup();
    expect(await screen.findByText("Màu in thật có thể khác màn hình.")).toBeInTheDocument();
    await confirmApprove(user);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/designs/review-queue"));
    expect(api.post).toHaveBeenCalledWith(reviewUrl, { version: 7, approved: true });
    expect(success).toHaveBeenCalledWith("Đã duyệt — đã sinh SKU riêng");
    expect(detailGets(api)).toBe(1);
  });

  it("đến từ vòng duyệt (?round=) → về vòng duyệt sau khi trả lại", async () => {
    vi.spyOn(toast, "success").mockImplementation(() => undefined);
    const api = openDetail(
      "SALES_MANAGER",
      { [reviewUrl]: () => ({ ...PENDING_DESIGN, status: "DRAFT", version: 8 }) },
      undefined,
      "?round=R-1",
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Trả lại" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/Lý do trả lại/), "  Logo bị mờ  ");
    expect(within(dialog).getByText("14/2000")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Trả lại" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/design-review-rounds/R-1"));
    expect(api.post).toHaveBeenCalledWith(reviewUrl, {
      version: 7,
      approved: false,
      notes: "Logo bị mờ",
    });
    expect(detailGets(api)).toBe(1);
  });

  it("trả lại thiếu lý do không gọi API", async () => {
    const api = openDetail("SALES_MANAGER", { [reviewUrl]: () => PENDING_DESIGN });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Trả lại" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/Lý do trả lại/), "    ");
    await user.click(within(dialog).getByRole("button", { name: "Trả lại" }));
    expect(await within(dialog).findByText(/Nhập lý do trả lại/)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("409 CONFLICT → tải lại chi tiết", async () => {
    const api = openDetail("SALES_MANAGER", {
      [reviewUrl]: () => {
        throw apiError(
          409,
          "CONFLICT",
          undefined,
          "Thiết kế vừa được thay đổi: tải lại rồi thử lại.",
        );
      },
    });
    const user = userEvent.setup();
    const dialog = await confirmApprove(user);
    expect(await within(dialog).findByText(/Thiết kế vừa được thay đổi/)).toBeInTheDocument();
    await waitFor(() => expect(detailGets(api)).toBe(2));
    expect(push).not.toHaveBeenCalled();
  });

  it("409 DESIGN_FILES_OUTDATED → hiện gợi ý trả lại và mở hộp trả lại", async () => {
    openDetail("SALES_MANAGER", {
      [reviewUrl]: () => {
        throw apiError(409, "DESIGN_FILES_OUTDATED", undefined, "Hãy xuất lại bộ file…");
      },
    });
    const user = userEvent.setup();
    await confirmApprove(user);
    const dialog = await screen.findByRole("dialog", { name: "Trả lại thiết kế cho khách" });
    expect(within(dialog).getByText(/File khách gửi không còn khớp bố cục/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Lý do trả lại/)).toBeInTheDocument();
  });

  it("hết giờ (không rõ kết quả) → không gửi lại, tải lại hàng đợi và về hàng đợi", async () => {
    const warning = vi.spyOn(toast, "warning").mockImplementation(() => undefined);
    const api = openDetail("SALES_MANAGER", {
      [reviewUrl]: () => {
        throw apiError(0, "NETWORK_ERROR");
      },
    });
    const user = userEvent.setup();
    await confirmApprove(user);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/designs/review-queue"));
    expect(warning).toHaveBeenCalledWith("Đang xử lý lâu — đã tải lại danh sách");
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(detailGets(api)).toBe(1);
  });

  it("404 khi mở chi tiết → 'không còn chờ duyệt'", async () => {
    openDetail("SALES_MANAGER", {}, apiError(404, "NOT_FOUND"));
    expect(await screen.findByText("Thiết kế không còn chờ duyệt")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Về hàng đợi" })).toHaveAttribute(
      "href",
      "/admin/designs/review-queue",
    );
  });

  it("SALES_STAFF không thấy nút Duyệt/Trả lại", async () => {
    openDetail("SALES_STAFF");
    expect(await screen.findByText("Ly giấy Tết 2027")).toBeInTheDocument();
    expect(screen.getByText("Chờ duyệt thiết kế")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Duyệt" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Trả lại" })).not.toBeInTheDocument();
  });

  it("file đã gửi: bản mới nhất mỗi loại, lần gửi trước thu gọn; kiểm tra file chỉ chạy khi bấm", async () => {
    const api = mockApi("SALES_MANAGER", {
      get: {
        ...detailRoutes(),
        [`${detailUrl}/artifacts/0a000000-0000-7000-8000-000000000004/preflight`]: () => ({
          passed: false,
          findings: [{ code: "FONT_NOT_EMBEDDED", detail: "Font Roboto", blocking: true }],
        }),
      },
    });
    renderScreen(<DesignReviewDetail id={DESIGN_ID} />, "SALES_MANAGER");
    const user = userEvent.setup();
    expect(await screen.findByText("print_ready.pdf")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Các lần gửi trước (2)" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    const preflightCalls = () =>
      api.get.mock.calls.filter((c) => String(c[0]).endsWith("/preflight"));
    expect(preflightCalls()).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Chạy kiểm tra" }));
    expect(await screen.findByText("File in có lỗi chặn — nên trả lại")).toBeInTheDocument();
    expect(screen.getByText(/Font chưa nhúng/)).toBeInTheDocument();
    expect(preflightCalls()).toHaveLength(1);
    // Không đạt chỉ cảnh báo — nút Duyệt vẫn bấm được.
    expect(screen.getByRole("button", { name: "Duyệt" })).toBeEnabled();
  });
});
