import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { toast } from "@/components/shared/Toast";
import { apiError, bePage, mockApi, renderScreen } from "@/test/api-screen";

import { DesignReviewDetail, ReviewQueueList } from "..";
import { designKeys } from "../queries";
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
  const view = renderScreen(<DesignReviewDetail id={DESIGN_ID} />, role, search);
  return Object.assign(api, { view });
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
    const api = mockApi("PRODUCTION_COORDINATOR", {
      get: {
        "/designs/review-queue": () => bePage([PENDING_DESIGN]),
        [`/customers/${CUSTOMER_ID}`]: () => CUSTOMER,
      },
    });
    renderScreen(<ReviewQueueList />, "PRODUCTION_COORDINATOR");
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

  it("cột khách hiện customerName của BE; thiếu thì mã rút gọn — Điều phối không có quyền xem khách nên không tra", async () => {
    const api = mockApi("PRODUCTION_COORDINATOR", {
      get: {
        "/designs/review-queue": () =>
          bePage([
            { ...PENDING_DESIGN, customerName: "Tên từ BE" },
            { ...PENDING_DESIGN, id: "0d-second", name: "Ly thứ hai" },
          ]),
      },
    });
    renderScreen(<ReviewQueueList />, "PRODUCTION_COORDINATOR");
    expect(await screen.findByText("Tên từ BE")).toBeInTheDocument();
    // Không tên, không mã: nhãn trung tính, không mảnh UUID (BO-UX-6)
    expect(screen.getAllByText("Khách hàng", { selector: "span" }).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain(`KH ${CUSTOMER_ID.slice(0, 8)}`);
    // V20261213000200 gives the coordinator no customer-customers:READ: no lookup by id.
    expect(api.get.mock.calls.filter((c) => c[0] === `/customers/${CUSTOMER_ID}`)).toHaveLength(0);
  });

  it("hàng đợi trống: 'Không có thiết kế nào chờ duyệt'", async () => {
    mockApi("PRODUCTION_COORDINATOR", { get: { "/designs/review-queue": () => bePage([]) } });
    renderScreen(<ReviewQueueList />, "PRODUCTION_COORDINATOR");
    expect(await screen.findByText("Không có thiết kế nào chờ duyệt")).toBeInTheDocument();
  });

  it("tab 'Theo dự án' dẫn tới vòng duyệt", async () => {
    mockApi("PRODUCTION_COORDINATOR", { get: { "/designs/review-queue": () => bePage([]) } });
    renderScreen(<ReviewQueueList />, "PRODUCTION_COORDINATOR");
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
    const api = openDetail("PRODUCTION_COORDINATOR", {
      [reviewUrl]: () => ({
        ...PENDING_DESIGN,
        status: "APPROVED",
        version: 8,
        customerSku: "KH-LY-0001",
      }),
    });
    const user = userEvent.setup();
    expect(await screen.findByText("Màu in thật có thể khác màn hình.")).toBeInTheDocument();
    await confirmApprove(user);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/designs/review-queue"));
    expect(api.post).toHaveBeenCalledWith(reviewUrl, { version: 7, approved: true });
    expect(success).toHaveBeenCalledWith("Đã duyệt — SKU riêng KH-LY-0001");
    expect(detailGets(api)).toBe(1);
  });

  it("duyệt kèm ghi chú: gửi ghi chú đã bỏ khoảng trắng; đóng hộp rồi mở lại thì ô ghi chú trống", async () => {
    const api = openDetail("PRODUCTION_COORDINATOR", {
      [reviewUrl]: () => ({ ...PENDING_DESIGN, status: "APPROVED", version: 8 }),
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Duyệt" }));
    let dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Ghi chú (tuỳ chọn)"), "Đã kiểm màu");
    await user.click(within(dialog).getByRole("button", { name: "Quay lại" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Duyệt" }));
    dialog = await screen.findByRole("dialog");
    const notes = within(dialog).getByLabelText("Ghi chú (tuỳ chọn)");
    expect(notes).toHaveValue("");
    await user.type(notes, "  In đúng màu  ");
    await user.click(within(dialog).getByRole("button", { name: "Duyệt" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(reviewUrl, {
        version: 7,
        approved: true,
        notes: "In đúng màu",
      }),
    );
  });

  it("đến từ vòng duyệt (?round=) → về vòng duyệt sau khi trả lại", async () => {
    vi.spyOn(toast, "success").mockImplementation(() => undefined);
    const api = openDetail(
      "PRODUCTION_COORDINATOR",
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
    const api = openDetail("PRODUCTION_COORDINATOR", { [reviewUrl]: () => PENDING_DESIGN });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Trả lại" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/Lý do trả lại/), "    ");
    await user.click(within(dialog).getByRole("button", { name: "Trả lại" }));
    expect(await within(dialog).findByText(/Nhập lý do trả lại/)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("409 CONFLICT → tải lại chi tiết", async () => {
    const callsTo = (url: string) => api.get.mock.calls.filter((call) => call[0] === url).length;
    const api = openDetail("PRODUCTION_COORDINATOR", {
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
    expect(await screen.findByText("print_ready.pdf")).toBeInTheDocument();
    await confirmApprove(user);
    // Hộp thoại đóng, nhắc xem lại; tải lại MỌI dữ liệu của thiết kế (file, lịch sử), không chỉ chi tiết.
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText(/xem lại bộ file rồi quyết định lại/)).toBeInTheDocument();
    await waitFor(() => expect(detailGets(api)).toBe(2));
    await waitFor(() => expect(callsTo(`${detailUrl}/artifacts`)).toBe(2));
    expect(callsTo(`${detailUrl}/history`)).toBe(2);
    expect(push).not.toHaveBeenCalled();
  });

  it("12 BR-11: tải lại nền ra bản 8 khi hộp Duyệt đang mở → vẫn gửi version 7 đã xem", async () => {
    let current: Record<string, unknown> = PENDING_DESIGN;
    const api = mockApi("PRODUCTION_COORDINATOR", {
      get: { ...detailRoutes(), [detailUrl]: () => current },
      post: {
        [reviewUrl]: () => {
          throw apiError(
            409,
            "CONFLICT",
            undefined,
            "Thiết kế vừa được thay đổi: tải lại rồi thử lại.",
          );
        },
      },
    });
    const { client } = renderScreen(
      <DesignReviewDetail id={DESIGN_ID} />,
      "PRODUCTION_COORDINATOR",
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Duyệt" }));
    const dialog = await screen.findByRole("dialog");
    current = { ...PENDING_DESIGN, version: 8 };
    await act(() => client.invalidateQueries({ queryKey: designKeys.detail(DESIGN_ID) }));
    await waitFor(() => expect(detailGets(api)).toBe(2));
    await user.click(within(dialog).getByRole("button", { name: "Duyệt" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post).toHaveBeenCalledWith(reviewUrl, { version: 7, approved: true });
    expect(await screen.findByText(/xem lại bộ file rồi quyết định lại/)).toBeInTheDocument();
  });

  it("đã rời trang khi lệnh duyệt xong → không bị kéo về hàng đợi", async () => {
    const success = vi.spyOn(toast, "success").mockImplementation(() => undefined);
    let finish: (value: unknown) => void = () => undefined;
    const api = openDetail("PRODUCTION_COORDINATOR", {
      [reviewUrl]: () => new Promise((resolve) => (finish = resolve)),
    });
    const user = userEvent.setup();
    await confirmApprove(user);
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    api.view.unmount();
    await act(async () => finish({ ...PENDING_DESIGN, status: "APPROVED", version: 8 }));
    await waitFor(() => expect(success).toHaveBeenCalledWith("Đã duyệt — đã sinh SKU riêng"));
    expect(push).not.toHaveBeenCalled();
  });

  it("409 DESIGN_FILES_OUTDATED → hiện message của BE và mở hộp trả lại", async () => {
    openDetail("PRODUCTION_COORDINATOR", {
      [reviewUrl]: () => {
        throw apiError(
          409,
          "DESIGN_FILES_OUTDATED",
          undefined,
          "Bộ file in của thiết kế này được xuất theo cấu hình in cũ.",
        );
      },
    });
    const user = userEvent.setup();
    await confirmApprove(user);
    const dialog = await screen.findByRole("dialog", { name: "Trả lại thiết kế cho khách" });
    expect(
      within(dialog).getByText("Bộ file in của thiết kế này được xuất theo cấu hình in cũ."),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Lý do trả lại/)).toBeInTheDocument();
  });

  it("hết giờ (không rõ kết quả) → không gửi lại, tải lại hàng đợi và về hàng đợi", async () => {
    const warning = vi.spyOn(toast, "warning").mockImplementation(() => undefined);
    const api = openDetail("PRODUCTION_COORDINATOR", {
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
    openDetail("PRODUCTION_COORDINATOR", {}, apiError(404, "NOT_FOUND"));
    expect(await screen.findByText("Thiết kế không còn chờ duyệt")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Về hàng đợi" })).toHaveAttribute(
      "href",
      "/admin/designs/review-queue",
    );
  });

  it("Lịch sử: chỉ hiện chữ người gõ (lý do trả lại, ghi chú khi duyệt), không hiện ghi chú máy tiếng Anh của BE", async () => {
    // Ghi chú BE (DesignReviewService.java:321, DesignSubmissionService.java:339, :369): APPROVED = "Snapshot …, SKU …,
    // checksum …[. <ghi chú>]", RETURNED = lý do; QUOTE_REQUESTED / SUBMITTED / PREFLIGHT_FAILED là chuỗi máy.
    const routes = detailRoutes();
    routes[`${detailUrl}/history`] = () =>
      bePage([
        {
          actorId: CUSTOMER_ID,
          decision: "APPROVED",
          version: 9,
          at: "2026-11-18T05:00:00Z",
          notes: "Snapshot s-1, SKU LY-TSM-01, checksum ab12cd. In đúng màu Pantone",
        },
        {
          actorId: CUSTOMER_ID,
          decision: "RETURNED",
          version: 8,
          at: "2026-11-18T04:00:00Z",
          notes: "Logo bị mờ",
        },
        {
          actorId: CUSTOMER_ID,
          decision: "QUOTE_REQUESTED",
          version: 7,
          at: "2026-11-18T03:30:00Z",
          notes: "10 carton(s)",
        },
        {
          actorId: CUSTOMER_ID,
          decision: "SUBMITTED_FOR_REVIEW",
          version: 7,
          at: "2026-11-18T03:00:00Z",
          notes: "Layout f51c870fe49d",
        },
        {
          actorId: CUSTOMER_ID,
          decision: "PREFLIGHT_FAILED",
          version: 6,
          at: "2026-11-18T02:00:00Z",
          notes: "OUTSIDE_PRINT_AREA BODY/e1",
        },
      ]);
    mockApi("PRODUCTION_COORDINATOR", { get: routes });
    renderScreen(<DesignReviewDetail id={DESIGN_ID} />, "PRODUCTION_COORDINATOR");

    const history = (await screen.findByText("Lịch sử")).closest("section");
    if (!history) throw new Error("history section not found");
    const panel = within(history);
    expect(await panel.findByText("In đúng màu Pantone")).toBeInTheDocument();
    expect(panel.getByText("Logo bị mờ")).toBeInTheDocument();
    for (const machine of [
      "10 carton(s)",
      "Layout f51c870fe49d",
      "OUTSIDE_PRINT_AREA",
      "Snapshot",
      "checksum",
    ]) {
      expect(history).not.toHaveTextContent(machine);
    }
  });

  it("SALES_STAFF không thấy nút Duyệt/Trả lại", async () => {
    openDetail("SALES_STAFF");
    expect(await screen.findByText("Ly giấy Tết 2027")).toBeInTheDocument();
    expect(screen.getByText("Chờ duyệt thiết kế")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Duyệt" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Trả lại" })).not.toBeInTheDocument();
  });

  it("file đã gửi: bản mới nhất mỗi loại, lần gửi trước thu gọn; kiểm tra file chỉ chạy khi bấm", async () => {
    const api = mockApi("PRODUCTION_COORDINATOR", {
      get: {
        ...detailRoutes(),
        [`${detailUrl}/artifacts/0a000000-0000-7000-8000-000000000004/preflight`]: () => ({
          passed: false,
          findings: [{ code: "FONT_NOT_EMBEDDED", detail: "Font Roboto", blocking: true }],
        }),
      },
    });
    renderScreen(<DesignReviewDetail id={DESIGN_ID} />, "PRODUCTION_COORDINATOR");
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
