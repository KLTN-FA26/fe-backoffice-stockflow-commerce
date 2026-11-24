/**
 * Chi tiết đơn — thẻ "Giữ hoàn tất" (WF-05 GH-2; BE `OrderCompletionHoldController`): hiện lần giữ đang mở, gửi đúng body
 * BE nhận khi giữ / gỡ giữ, ẩn với đơn đã qua hoàn tất và với vai không có `sales-order-holds:UPDATE`.
 */
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { toast } from "@/components/shared/Toast";

import { DETAIL_PATH } from "../__fixtures__/detail";
import { apiOrder, apiOrderAt } from "../__fixtures__/order";
import {
  ORDER_PERMISSION_SETS,
  mockOrderApiGet,
  pickOrderSelectOption,
  renderOrderScreen,
} from "../__fixtures__/render";
import { OrderDetail } from "./OrderDetail";

import type { PermissionCode } from "@/lib/auth";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(() => vi.restoreAllMocks());

const HOLD_PATH = `${DETAIL_PATH}/completion-hold`;
const openHold = {
  id: "h0000000-0000-4000-8000-000000000001",
  orderId: apiOrder.orderId,
  reasonCode: "DELIVERY_DISPUTED",
  note: "Khách báo chưa nhận được thùng nào",
  heldAt: "2026-11-18T03:00:00Z",
  heldBy: "u-sale-01",
};

async function renderWith(
  permissions: readonly PermissionCode[],
  hold: unknown,
  status: Parameters<typeof apiOrderAt>[0] = "DELIVERED",
  // BE `OrderCompletionHolds.hold`: chỉ đơn đã có lần giao tới khách (ck_order_delivered_at: DELIVERED có deliveredAt);
  // nút theo cờ BE `settlementReadiness.completionHoldable` (audit r2 lifecycle M-4)
  patch: Record<string, unknown> = {
    deliveredAt: "2026-11-17T03:00:00Z",
    settlementReadiness: { branch: "COMPLETION", completionHoldable: true },
  },
) {
  mockOrderApiGet(permissions, {
    [DETAIL_PATH]: () => apiOrderAt(status, patch),
    [HOLD_PATH]: () => hold,
  });
  await act(async () => {
    renderOrderScreen(<OrderDetail params={Promise.resolve({ id: apiOrder.orderId })} />);
  });
  await screen.findByRole("heading", { name: apiOrder.orderNumber });
}

const card = () => screen.findByRole("region", { name: "Giữ hoàn tất" });

describe("OrderDetail — Giữ hoàn tất (WF-05 GH-2)", () => {
  it("đang giữ → Đang giữ hoàn tất, nhãn lý do, ghi chú, lúc giữ; Sale thấy Gỡ giữ", async () => {
    await renderWith(ORDER_PERMISSION_SETS.salesStaff, openHold);
    const region = within(await card());
    expect(region.getByText("Đang giữ hoàn tất")).toBeInTheDocument();
    expect(region.getByText("Khách khiếu nại giao hàng")).toBeInTheDocument();
    expect(region.getByText(openHold.note)).toBeInTheDocument();
    expect(region.getByText("Giữ lúc")).toBeInTheDocument();
    expect(region.getByRole("button", { name: /Gỡ giữ/ })).toBeInTheDocument();
    expect(region.queryByRole("button", { name: /Giữ hoàn tất/ })).not.toBeInTheDocument();
  });

  it("Sale giữ hoàn tất: chọn lý do + ghi chú → POST {reasonCode, note} kèm Idempotency-Key", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: openHold });
    await renderWith(ORDER_PERMISSION_SETS.salesStaff, null);
    const region = within(await card());
    await userEvent.click(region.getByRole("button", { name: /Giữ hoàn tất/ }));
    const dialog = await screen.findByRole("dialog");
    await pickOrderSelectOption(userEvent, /Lý do giữ/, "Lý do khác");
    await userEvent.type(within(dialog).getByLabelText(/Ghi chú/), "Hãng đang đối soát");
    await userEvent.click(within(dialog).getByRole("button", { name: "Giữ hoàn tất" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        HOLD_PATH,
        { reasonCode: "OTHER", note: "Hãng đang đối soát" },
        expect.objectContaining({ headers: { "Idempotency-Key": expect.any(String) } }),
      ),
    );
  });

  it("Lý do khác mà không ghi chú → không gửi, báo lỗi tại ô", async () => {
    const post = vi.spyOn(api, "post");
    await renderWith(ORDER_PERMISSION_SETS.salesStaff, null);
    await userEvent.click(within(await card()).getByRole("button", { name: /Giữ hoàn tất/ }));
    const dialog = await screen.findByRole("dialog");
    await pickOrderSelectOption(userEvent, /Lý do giữ/, "Lý do khác");
    await userEvent.click(within(dialog).getByRole("button", { name: "Giữ hoàn tất" }));
    expect(await within(dialog).findByText(/Nhập ghi chú khi chọn/)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("gỡ giữ: ghi kết quả xác minh → POST …/release {note}; 409 NOT_HELD → câu tiếng Việt, đóng hộp thoại", async () => {
    const post = vi
      .spyOn(api, "post")
      .mockRejectedValue(new ApiError(409, "ORDER_COMPLETION_NOT_HELD", "not held"));
    const toastError = vi.spyOn(toast, "error");
    await renderWith(ORDER_PERMISSION_SETS.salesStaff, openHold);
    await userEvent.click(within(await card()).getByRole("button", { name: /Gỡ giữ/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(
      within(dialog).getByLabelText(/Kết quả xác minh/),
      "Hãng xác nhận đã giao",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Gỡ giữ" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        `${HOLD_PATH}/release`,
        { note: "Hãng xác nhận đã giao" },
        expect.objectContaining({ headers: { "Idempotency-Key": expect.any(String) } }),
      ),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(toastError).toHaveBeenCalledWith(
      "Không gỡ giữ hoàn tất được",
      expect.stringContaining("không còn bị giữ hoàn tất"),
    );
    expect(String(toastError.mock.calls[0]?.[1])).not.toContain("not held");
  });

  it("Quản lý kho (chỉ đọc) → thấy lần giữ, không có nút", async () => {
    await renderWith(ORDER_PERMISSION_SETS.warehouseManager, openHold);
    const region = within(await card());
    expect(region.getByText("Đang giữ hoàn tất")).toBeInTheDocument();
    expect(region.queryByRole("button")).not.toBeInTheDocument();
  });

  it("audit r2 M-4: đơn Hoàn tiền một phần (lô A đã giao) → vẫn có nút Giữ hoàn tất", async () => {
    await renderWith(ORDER_PERMISSION_SETS.salesStaff, null, "PARTIALLY_REFUNDED", {
      deliveredAt: null,
      settlementReadiness: { branch: "REFUND_CLOSE", completionHoldable: true },
      shipments: [
        { shipmentId: "s-a", status: "DELIVERED", outcomeAt: "2026-11-17T03:00:00Z" },
        { shipmentId: "s-b", status: "RETURNED", outcomeAt: "2026-11-17T05:00:00Z" },
      ],
    });
    const region = within(await card());
    expect(region.getByRole("button", { name: /Giữ hoàn tất/ })).toBeInTheDocument();
  });

  it("audit r2 M-4: đơn chưa giao gì → không hiện thẻ (BE 409 ORDER_COMPLETION_HOLD_NOT_APPLICABLE)", async () => {
    await renderWith(ORDER_PERMISSION_SETS.salesStaff, null, "CONFIRMED", {});
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(HOLD_PATH, expect.anything()));
    expect(screen.queryByRole("region", { name: "Giữ hoàn tất" })).not.toBeInTheDocument();
  });

  it("audit r2 M-4: BE nói không giữ được (completionHoldable false) → không hiện thẻ, dù đơn đã giao", async () => {
    await renderWith(ORDER_PERMISSION_SETS.salesStaff, null, "DELIVERED", {
      deliveredAt: "2026-11-17T03:00:00Z",
      settlementReadiness: { branch: "COMPLETION", completionHoldable: false },
    });
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(HOLD_PATH, expect.anything()));
    expect(screen.queryByRole("region", { name: "Giữ hoàn tất" })).not.toBeInTheDocument();
  });

  it("đơn đã hoàn tất, không có lần giữ mở → không hiện thẻ", async () => {
    await renderWith(ORDER_PERMISSION_SETS.salesStaff, null, "COMPLETED", {
      deliveredAt: "2026-11-17T03:00:00Z",
      completedAt: "2026-11-20T03:00:00Z",
      settlementReadiness: { branch: "NONE", completionHoldable: false },
    });
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(HOLD_PATH, expect.anything()));
    expect(screen.queryByRole("region", { name: "Giữ hoàn tất" })).not.toBeInTheDocument();
  });
});
