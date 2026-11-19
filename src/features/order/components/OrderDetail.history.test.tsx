/**
 * Màn chi tiết đơn — lịch sử đơn có quyết định giao một phần (BE PR #150).
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { apiOrder, apiOrderPartialShipment } from "../__fixtures__/order";
import { HISTORY_PATH, renderDetail } from "../__fixtures__/detail";
import { ORDER_PERMISSION_SETS } from "../__fixtures__/render";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

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

  it("ghi chú là mã hệ thống (CONTRACT_SENT…) → nhãn tiếng Việt; mã lạ giữ nguyên văn", async () => {
    const entry = (to: string, reason: string, hour: number) => ({
      type: "STATUS_CHANGE",
      from: null,
      to,
      reason,
      occurredAt: `2026-10-20T0${hour}:00:00Z`,
    });
    await renderDetail(
      ORDER_PERMISSION_SETS.readOnly,
      () => apiOrder,
      () => [
        entry("PENDING_CONTRACT", "CONTRACT_SENT", 1),
        entry("PENDING_PAYMENT", "CONTRACT_SIGNED", 2),
        entry("CONFIRMED", "INSTALLMENT_PAID", 3),
        entry("AWAITING_STOCK", "PRODUCTION_ORDER_SENT", 4),
        entry("PICKING", "SOMETHING_NEW", 5),
      ],
    );
    const history = await screen.findByRole("region", { name: "Lịch sử đơn" });
    expect(await within(history).findByText("Đã gửi hợp đồng cho khách")).toBeInTheDocument();
    expect(within(history).getByText("Khách đã ký hợp đồng")).toBeInTheDocument();
    expect(within(history).getByText(/Đã thu đủ các đợt thanh toán/)).toBeInTheDocument();
    expect(within(history).getByText("Đã gửi Đơn sản xuất")).toBeInTheDocument();
    expect(within(history).queryByText("CONTRACT_SENT")).not.toBeInTheDocument();
    expect(within(history).getByText("SOMETHING_NEW")).toBeInTheDocument();
  });

  it("WF-05: CODE / CODE: ghi chú / RETURN_REQUESTED <RMA> / HOLD_RESOLVED_<lý do> → nhãn + ghi chú", async () => {
    const entry = (to: string, reason: string, hour: number) => ({
      type: "STATUS_CHANGE",
      from: null,
      to,
      reason,
      occurredAt: `2026-11-1${hour}T01:00:00Z`,
    });
    await renderDetail(
      ORDER_PERMISSION_SETS.readOnly,
      () => apiOrder,
      () => [
        entry("ON_HOLD", "ADDRESS: Sai phường", 1),
        entry("PICKING", "HOLD_RESOLVED_ADDRESS: Khách đã sửa", 2),
        entry("RETURN_REQUESTED", "RETURN_REQUESTED RMA-20261113-0001", 3),
        entry("RETURNED", "REFUND_VOIDED: Chuyển nhầm", 4),
      ],
    );
    const history = await screen.findByRole("region", { name: "Lịch sử đơn" });
    expect(
      await within(history).findByText("Sai địa chỉ / hãng vận chuyển không giao tới — Sai phường"),
    ).toBeInTheDocument();
    expect(
      within(history).getByText(
        "Gỡ giữ đơn (Sai địa chỉ / hãng vận chuyển không giao tới) — Khách đã sửa",
      ),
    ).toBeInTheDocument();
    expect(
      within(history).getByText("Khách yêu cầu trả hàng — RMA-20261113-0001"),
    ).toBeInTheDocument();
    expect(within(history).getByText("Huỷ phiếu hoàn tiền — Chuyển nhầm")).toBeInTheDocument();
    expect(within(history).queryByText(/HOLD_RESOLVED|REFUND_VOIDED/)).not.toBeInTheDocument();
  });

  it("đóng phần còn lại render riêng: 'Đóng phần còn lại: <lý do>', ai, khi nào, ghi chú; không lộ mã thô", async () => {
    await renderDetail(
      ORDER_PERMISSION_SETS.readOnly,
      () => apiOrder,
      () => [
        {
          type: "STATUS_CHANGE",
          from: "PICKING",
          to: "PARTIALLY_FULFILLED",
          occurredAt: "2026-11-20T01:00:00Z",
        },
        {
          type: "REMAINDER_CLOSURE",
          from: null,
          to: null,
          reason: "hết nắp",
          occurredAt: "2026-11-20T02:00:00Z",
          actorId: "u-sale",
          actorName: "Sale An",
          closureReasonCode: "OUT_OF_STOCK",
        },
        {
          type: "REMAINDER_CLOSURE",
          occurredAt: "2026-11-20T03:00:00Z",
          closureReasonCode: "DELIVERY_FAILED",
        },
        {
          type: "STATUS_CHANGE",
          from: "PARTIALLY_FULFILLED",
          to: "SHIPPED",
          reason: "REMAINDER_CLOSED_OUT_OF_STOCK: hết nắp",
          occurredAt: "2026-11-20T04:00:00Z",
        },
      ],
    );

    const history = await screen.findByRole("region", { name: "Lịch sử đơn" });
    const items = await within(history).findAllByRole("listitem");
    expect(items.map((item) => item.getAttribute("data-kind"))).toEqual([
      "status-change",
      "remainder-closure",
      "remainder-closure",
      "status-change",
    ]);

    const closed = items[1] as HTMLElement;
    expect(
      within(closed).getByText("Đóng phần còn lại: Hết hàng, không cung cấp được"),
    ).toBeInTheDocument();
    expect(within(closed).getByText(/Bởi Sale An/)).toBeInTheDocument();
    expect(within(closed).getByText("hết nắp")).toBeInTheDocument();

    // không ghi chú thì không hiện dòng "Ghi chú"
    const afterFailure = items[2] as HTMLElement;
    expect(
      within(afterFailure).getByText("Đóng phần còn lại: Giao hàng không thành công"),
    ).toBeInTheDocument();
    expect(within(afterFailure).queryByText(/Ghi chú/)).not.toBeInTheDocument();

    // bước đổi trạng thái do chính lần đóng đó: lý do là nhãn tiếng Việt, không phải mã BE
    const moved = items[3] as HTMLElement;
    expect(within(moved).getByText("Hết hàng, không cung cấp được — hết nắp")).toBeInTheDocument();
    expect(history).not.toHaveTextContent("REMAINDER_CLOSED");
    expect(history).not.toHaveTextContent("OUT_OF_STOCK");
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
