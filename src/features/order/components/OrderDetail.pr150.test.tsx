/**
 * Màn chi tiết đơn — BE PR #150: giao một phần do Sales quyết, lịch sử có quyết định, đóng phần còn lại kèm
 * phí đã thoả thuận, thu phần còn lại ON_CREDIT, huỷ đơn khi hàng có sẵn đã đóng trước hàng in.
 */
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { toast } from "@/components/shared/Toast";

import {
  apiOrder,
  apiOrderPartialShipment,
  apiOrderWith,
  apiPartialOrder,
} from "../__fixtures__/order";
import {
  ORDER_PERMISSION_SETS,
  mockOrderApiGet,
  pickSelectOption,
  renderOrderScreen,
} from "../__fixtures__/render";

import { OrderDetail } from "./OrderDetail";

import type { PermissionCode } from "@/lib/auth";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const DETAIL_PATH = `/orders/${apiOrder.orderId}`;
const HISTORY_PATH = `${DETAIL_PATH}/history`;
const PARTIAL_PATH = `${DETAIL_PATH}/partial-shipment`;

async function renderDetail(
  permissions: readonly PermissionCode[],
  handler: () => unknown,
  history: () => unknown = () => [],
) {
  mockOrderApiGet(permissions, { [DETAIL_PATH]: handler, [HISTORY_PATH]: history });
  await act(async () => {
    renderOrderScreen(<OrderDetail params={Promise.resolve({ id: apiOrder.orderId })} />);
  });
}

afterEach(() => vi.restoreAllMocks());

describe("OrderDetail — Giao một phần (sales-order-partial-shipments:UPDATE)", () => {
  it("SALES_STAFF + cờ tắt → hiện trạng thái, bấm 'Cho phép giao một phần' + ghi chú → PUT {allowed: true, note}", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.salesStaff, () =>
      apiOrderPartialShipment("PICKING", { allowPartialShipment: false }),
    );
    const put = vi.spyOn(api, "put").mockResolvedValue({ data: apiOrder });
    const toastSuccess = vi.spyOn(toast, "success");
    const user = userEvent.setup();

    expect(await screen.findByText(/Chưa cho phép/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cho phép giao một phần" }));
    await user.type(screen.getByLabelText(/Ghi chú/), "  Khách đồng ý nhận hàng sẵn trước  ");
    await user.click(screen.getByRole("button", { name: "Cho phép" }));

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith(PARTIAL_PATH, {
        allowed: true,
        note: "Khách đồng ý nhận hàng sẵn trước",
      }),
    );
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Đã cho phép giao một phần"));
    // Dialog đóng sau khi thành công; đơn được tải lại (cờ mới nằm ở response GET)
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() =>
      expect(vi.mocked(api.get).mock.calls.filter(([url]) => url === DETAIL_PATH)).toHaveLength(2),
    );
  });

  it("cờ đang bật → nút 'Dừng giao một phần'; không ghi chú thì body không có note", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.salesStaff, () =>
      apiOrderPartialShipment("PICKING", { allowPartialShipment: true }),
    );
    const put = vi.spyOn(api, "put").mockResolvedValue({ data: apiOrder });
    const user = userEvent.setup();

    expect(await screen.findByText("Đang cho phép")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Dừng giao một phần" }));
    await user.click(screen.getByRole("button", { name: "Dừng giao một phần", hidden: false }));

    await waitFor(() => expect(put).toHaveBeenCalledWith(PARTIAL_PATH, { allowed: false }));
  });

  it.each([
    ["điều phối viên (không có mã sales-order-partial-shipments:UPDATE)", "coordinator"],
    ["tài khoản chỉ đọc", "readOnly"],
  ] as const)("gate theo mã quyền: %s thấy trạng thái nhưng không có nút", async (_name, set) => {
    await renderDetail(ORDER_PERMISSION_SETS[set], () =>
      apiOrderPartialShipment("PICKING", { allowPartialShipment: false }),
    );
    expect(await screen.findByText(/Chưa cho phép/)).toBeInTheDocument();
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith("/identity/me/permissions", expect.anything()),
    );
    expect(screen.queryByRole("button", { name: /giao một phần/i })).not.toBeInTheDocument();
  });

  it("BE không trả cờ → không hiện thẻ 'Giao một phần' (không đoán)", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.salesStaff, () => apiOrder);
    await screen.findByRole("heading", { name: apiOrder.orderNumber });
    expect(screen.queryByText("Giao một phần")).not.toBeInTheDocument();
  });

  it("đơn đã SHIPPED → khoá: không có nút, giải thích đơn đã đi / đóng", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.salesStaff, () =>
      apiOrderPartialShipment("SHIPPED", { allowPartialShipment: true }),
    );
    expect(await screen.findByText(/không còn đổi được cách giao/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /giao một phần/i })).not.toBeInTheDocument();
  });

  it("đơn giao dở còn chờ hàng in → không cho dừng, giải thích đơn đã tách", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.salesStaff, () => ({
      ...apiPartialOrder,
      allowPartialShipment: true,
      printLinesReady: false,
    }));
    expect(await screen.findByText(/đơn đã tách/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dừng giao một phần" })).not.toBeInTheDocument();
  });

  it("409 ORDER_PARTIAL_SHIPMENT_LOCKED → toast tiếng Việt, đóng dialog, tải lại đơn", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.salesStaff, () =>
      apiOrderPartialShipment("PICKING", { allowPartialShipment: true }),
    );
    vi.spyOn(api, "put").mockRejectedValue(
      new ApiError(409, "ORDER_PARTIAL_SHIPMENT_LOCKED", "English"),
    );
    const toastError = vi.spyOn(toast, "error");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Dừng giao một phần" }));
    await user.click(screen.getByRole("button", { name: "Dừng giao một phần", hidden: false }));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0]?.[0]).toBe("Không cập nhật được giao một phần");
    expect(String(toastError.mock.calls[0]?.[1])).toContain("Không đổi được cách giao");
    await waitFor(() =>
      expect(vi.mocked(api.get).mock.calls.filter(([url]) => url === DETAIL_PATH)).toHaveLength(2),
    );
  });

  it("lỗi mạng → dialog vẫn mở, lỗi hiện trong dialog", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.salesStaff, () =>
      apiOrderPartialShipment("PICKING", { allowPartialShipment: false }),
    );
    vi.spyOn(api, "put").mockRejectedValue(new ApiError(0, "NETWORK_ERROR", "x"));
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Cho phép giao một phần" }));
    await user.click(screen.getByRole("button", { name: "Cho phép" }));

    expect(await screen.findByText(/Không kết nối được máy chủ/)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("OrderDetail — Lịch sử đơn có quyết định giao một phần", () => {
  const HISTORY = [
    {
      type: "STATUS_CHANGE",
      from: null,
      to: "PENDING_PAYMENT",
      occurredAt: "2026-10-20T01:00:00Z",
    },
    {
      type: "STATUS_CHANGE",
      from: "PENDING_PAYMENT",
      to: "CONFIRMED",
      occurredAt: "2026-10-20T02:00:00Z",
      actorName: "Kế toán B",
    },
    {
      type: "PARTIAL_SHIPMENT_DECISION",
      from: null,
      to: null,
      reason: "Khách đồng ý nhận hàng sẵn trước",
      occurredAt: "2026-10-21T03:00:00Z",
      actorId: "u-sale",
      actorName: "Sale An",
      partialShipmentAllowed: true,
    },
    {
      type: "PARTIAL_SHIPMENT_DECISION",
      from: null,
      to: null,
      occurredAt: "2026-10-21T04:00:00Z",
      actorName: "Sale An",
      partialShipmentAllowed: false,
    },
  ];

  it("quyết định render riêng: 'Bật / Tắt giao một phần', ai, khi nào, ghi chú; đổi trạng thái vẫn hiện từ → đến", async () => {
    await renderDetail(
      ORDER_PERMISSION_SETS.readOnly,
      () => apiOrder,
      () => HISTORY,
    );

    const history = await screen.findByRole("region", { name: "Lịch sử đơn" });
    const items = await within(history).findAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(items.map((item) => item.getAttribute("data-kind"))).toEqual([
      "status-change",
      "status-change",
      "partial-shipment",
      "partial-shipment",
    ]);

    const on = items[2] as HTMLElement;
    expect(within(on).getByText("Bật giao một phần")).toBeInTheDocument();
    expect(within(on).getByText(/Bởi Sale An/)).toBeInTheDocument();
    expect(within(on).getByText("Khách đồng ý nhận hàng sẵn trước")).toBeInTheDocument();
    expect(within(on).getByText(/2026|21\/10|10\/21/)).toBeInTheDocument();

    const off = items[3] as HTMLElement;
    expect(within(off).getByText("Tắt giao một phần")).toBeInTheDocument();
    // không ghi chú thì không hiện dòng "Ghi chú"
    expect(within(off).queryByText(/Ghi chú/)).not.toBeInTheDocument();

    // Mục đổi trạng thái: không phải "giao một phần"; có từ → đến và người thực hiện
    const moved = items[1] as HTMLElement;
    expect(within(moved).queryByText(/giao một phần/)).not.toBeInTheDocument();
    expect(within(moved).getByText("Chờ thanh toán")).toBeInTheDocument();
    expect(within(moved).getByText("Đã xác nhận")).toBeInTheDocument();
    expect(within(moved).getByText(/Bởi Kế toán B/)).toBeInTheDocument();
    // Bước đầu (from null) ghi "Đặt đơn"
    expect(within(items[0] as HTMLElement).getByText("Đặt đơn")).toBeInTheDocument();
  });

  it("chưa có mục nào → thông báo rỗng", async () => {
    await renderDetail(
      ORDER_PERMISSION_SETS.readOnly,
      () => apiOrder,
      () => [],
    );
    expect(await screen.findByText("Chưa có thay đổi nào được ghi lại")).toBeInTheDocument();
  });

  it("lịch sử lỗi không làm hỏng trang chi tiết", async () => {
    await renderDetail(
      ORDER_PERMISSION_SETS.readOnly,
      () => apiOrder,
      () => {
        throw new ApiError(403, "FORBIDDEN", "x");
      },
    );
    expect(await screen.findByRole("heading", { name: apiOrder.orderNumber })).toBeInTheDocument();
    expect(await screen.findByText(/Không tải được lịch sử đơn/)).toBeInTheDocument();
  });

  it("sau khi bật / tắt giao một phần, lịch sử được tải lại", async () => {
    await renderDetail(
      ORDER_PERMISSION_SETS.salesStaff,
      () => apiOrderPartialShipment("PICKING", { allowPartialShipment: false }),
      () => HISTORY,
    );
    vi.spyOn(api, "put").mockResolvedValue({ data: apiOrder });
    const user = userEvent.setup();
    await screen.findAllByRole("listitem");
    const historyCalls = () =>
      vi.mocked(api.get).mock.calls.filter(([url]) => url === HISTORY_PATH).length;
    const before = historyCalls();

    await user.click(screen.getByRole("button", { name: "Cho phép giao một phần" }));
    await user.click(screen.getByRole("button", { name: "Cho phép" }));

    await waitFor(() => expect(historyCalls()).toBeGreaterThan(before));
  });
});

describe("OrderDetail — Đóng phần còn lại kèm phí đã thoả thuận", () => {
  const CLOSURE_PATH = `${DETAIL_PATH}/remainder-closure`;

  async function openClosureDialog(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole("button", { name: "Đóng phần còn lại" }));
    await pickSelectOption(user, /Lý do đóng/, "Khách yêu cầu");
  }
  const submit = (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getAllByRole("button", { name: "Đóng phần còn lại" }).at(-1) as HTMLElement);

  async function fillFee(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("checkbox", { name: /Giữ một khoản phí/ }));
    await user.type(screen.getByLabelText(/Số tiền phí/), "4.000.000");
    await user.type(screen.getByLabelText(/Lý do giữ phí/), "  Đã in 2 lô  ");
    await user.type(screen.getByLabelText(/Chi tiết đã thoả thuận/), "Khách đồng ý qua điện thoại");
  }

  it("bật phí → POST kèm agreedFee {amount (số nguyên VND), reason, detail} đã trim", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.salesStaff, () => apiPartialOrder);
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: null });
    const user = userEvent.setup();

    await openClosureDialog(user);
    await fillFee(user);
    await submit(user);

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(CLOSURE_PATH, {
        reasonCode: "CUSTOMER_REQUEST",
        agreedFee: {
          amount: 4_000_000,
          reason: "Đã in 2 lô",
          detail: "Khách đồng ý qua điện thoại",
        },
      }),
    );
  });

  it("không bật phí → body không có agreedFee", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.salesStaff, () => apiPartialOrder);
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: null });
    const user = userEvent.setup();

    await openClosureDialog(user);
    await submit(user);

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(CLOSURE_PATH, { reasonCode: "CUSTOMER_REQUEST" }),
    );
  });

  it("số tiền có dấu thập phân → báo lỗi thay vì đọc thành số lớn gấp 100 lần; số hợp lệ hiện bản xem trước", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.salesStaff, () => apiPartialOrder);
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: null });
    const user = userEvent.setup();

    await openClosureDialog(user);
    await fillFee(user);
    // fillFee gõ "4.000.000" → bản xem trước đúng số sẽ gửi
    expect(screen.getByText(/Sẽ ghi nhận: .*4\.000\.000/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/Số tiền phí/));
    await user.type(screen.getByLabelText(/Số tiền phí/), "150000.50");
    expect(screen.queryByText(/Sẽ ghi nhận/)).not.toBeInTheDocument();
    await submit(user);

    expect(await screen.findByText("Nhập số tiền nguyên lớn hơn 0")).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("phí không hợp lệ (số tiền, lý do, chi tiết) → chặn trước khi gọi API, lỗi từng ô", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.salesStaff, () => apiPartialOrder);
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: null });
    const user = userEvent.setup();

    await openClosureDialog(user);
    await user.click(screen.getByRole("checkbox", { name: /Giữ một khoản phí/ }));
    await user.type(screen.getByLabelText(/Số tiền phí/), "12abc");
    await submit(user);

    expect(await screen.findByText("Nhập số tiền nguyên lớn hơn 0")).toBeInTheDocument();
    expect(screen.getByText("Nhập lý do giữ phí")).toBeInTheDocument();
    expect(screen.getByText("Nhập chi tiết đã thoả thuận")).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();

    // Sửa số tiền → lỗi của ô đó biến mất ngay
    await user.clear(screen.getByLabelText(/Số tiền phí/));
    await user.type(screen.getByLabelText(/Số tiền phí/), "1000");
    expect(screen.queryByText("Nhập số tiền nguyên lớn hơn 0")).not.toBeInTheDocument();
  });

  it("409 CANCELLATION_FEE_BEFORE_PRINTING → dialog giữ nguyên, báo tiếng Việt; bỏ phí rồi gửi lại được", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.salesStaff, () => apiPartialOrder);
    const post = vi
      .spyOn(api, "post")
      .mockRejectedValueOnce(new ApiError(409, "CANCELLATION_FEE_BEFORE_PRINTING", "English"))
      .mockResolvedValueOnce({ data: null });
    const user = userEvent.setup();

    await openClosureDialog(user);
    await fillFee(user);
    await submit(user);

    expect(await screen.findByText(/Đơn chưa bắt đầu in/)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText(/Số tiền phí/)).toHaveValue("4.000.000");

    await user.click(screen.getByRole("checkbox", { name: /Giữ một khoản phí/ }));
    await submit(user);
    await waitFor(() =>
      expect(post).toHaveBeenLastCalledWith(CLOSURE_PATH, { reasonCode: "CUSTOMER_REQUEST" }),
    );
  });

  it("400 phí vượt giá trị hàng in → câu tiếng Việt nêu giới hạn, dialog giữ nguyên", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.salesStaff, () => apiPartialOrder);
    vi.spyOn(api, "post").mockRejectedValue(new ApiError(400, "VALIDATION_FAILED", "English"));
    const user = userEvent.setup();

    await openClosureDialog(user);
    await fillFee(user);
    await submit(user);

    expect(await screen.findByText(/không vượt giá trị phần hàng in bị đóng/)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("mở lại hộp thoại thì ô phí được xoá sạch", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.salesStaff, () => apiPartialOrder);
    vi.spyOn(api, "post").mockResolvedValue({ data: null });
    const user = userEvent.setup();

    await openClosureDialog(user);
    await fillFee(user);
    await user.click(screen.getByRole("button", { name: "Huỷ" }));
    await user.click(screen.getByRole("button", { name: "Đóng phần còn lại" }));

    expect(screen.getByRole("checkbox", { name: /Giữ một khoản phí/ })).not.toBeChecked();
    expect(screen.queryByLabelText(/Số tiền phí/)).not.toBeInTheDocument();
  });
});

describe("OrderDetail — thu phần còn lại ON_CREDIT", () => {
  it("đơn cọc ON_CREDIT: hiện 'Ghi công nợ phần còn lại' và hạn công nợ", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.readOnly, () =>
      apiOrderWith({ paymentTerm: "DEPOSIT", balancePolicy: "ON_CREDIT", creditTermDays: 30 }),
    );
    expect(await screen.findByText("Ghi công nợ phần còn lại")).toBeInTheDocument();
    expect(screen.getByText("30 ngày sau khi giao")).toBeInTheDocument();
  });

  it.each([
    ["BEFORE_DELIVERY", "Chuyển khoản trước khi giao"],
    ["ON_DELIVERY", "Thu hộ khi giao hàng (COD)"],
    ["BRAND_NEW", "Không rõ"],
  ])("balancePolicy %s → %s", async (policy, label) => {
    await renderDetail(ORDER_PERMISSION_SETS.readOnly, () =>
      apiOrderWith({ paymentTerm: "DEPOSIT", balancePolicy: policy }),
    );
    expect(await screen.findByText(label)).toBeInTheDocument();
    expect(screen.queryByText(/ngày sau khi giao/)).not.toBeInTheDocument();
  });

  it("đơn không có balancePolicy → không hiện dòng 'Thu phần còn lại'", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.readOnly, () => apiOrder);
    await screen.findByRole("heading", { name: apiOrder.orderNumber });
    expect(screen.queryByText("Thu phần còn lại")).not.toBeInTheDocument();
  });
});

describe("OrderDetail — huỷ đơn khi hàng có sẵn đã đóng trước hàng in (BE PR #150)", () => {
  const packedAt = "2026-10-22T01:00:00Z";

  it("IN_PRODUCTION có packedAt, chưa lô nào đi → vẫn có nút Huỷ đơn", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, () =>
      apiOrderWith({ status: "IN_PRODUCTION", packedAt }),
    );
    expect(await screen.findByRole("button", { name: "Huỷ đơn" })).toBeInTheDocument();
  });

  it("đã có lô rời kho → không còn nút Huỷ đơn", async () => {
    await renderDetail(ORDER_PERMISSION_SETS.coordinator, () =>
      apiOrderWith({
        status: "IN_PRODUCTION",
        packedAt,
        shipments: apiPartialOrder.shipments,
      }),
    );
    await screen.findByRole("heading", { name: apiOrder.orderNumber });
    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith("/identity/me/permissions", expect.anything()),
    );
    expect(screen.queryByRole("button", { name: "Huỷ đơn" })).not.toBeInTheDocument();
  });
});
