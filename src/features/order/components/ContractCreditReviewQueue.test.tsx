import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { contractDraft } from "../__fixtures__/contract";
import { apiCreditPosition, apiOrderPage } from "../__fixtures__/order";
import { ORDER_PERMISSION_SETS, mockOrderApiGet, renderOrderScreen } from "../__fixtures__/render";
import { CreditHoldList } from "./credit-hold/CreditHoldList";

import type { PermissionCode } from "@/lib/auth";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const ORDER_ID = "aaaaaaaa-0000-4000-8000-000000000001";
const CUSTOMER_ID = "bbbbbbbb-0000-4000-8000-000000000001";
const review = {
  reviewId: "cccccccc-0000-4000-8000-000000000001",
  orderId: ORDER_ID,
  orderNumber: "SO-20261126-0001",
  contractId: "dddddddd-0000-4000-8000-000000000001",
  contractNumber: "HD-20261126-0001-1",
  contractVersion: 3,
  customerId: CUSTOMER_ID,
  customer: { customerId: CUSTOMER_ID, name: "Công ty Ly Giấy Xanh", code: "KH-0001" },
  checkOutcome: "OVER_LIMIT",
  creditLimit: 300_000_000,
  exposure: 290_000_000,
  afterDelivery: 27_142_500,
  overdueAmount: 0,
  submittedBy: "eeeeeeee-0000-4000-8000-000000000001",
  submittedAt: "2026-11-26T03:00:00Z",
};
const page = (items: unknown[]) => ({
  items,
  page: 0,
  size: 15,
  totalElements: items.length,
  totalPages: 1,
  hasNext: false,
  hasPrevious: false,
});

function renderQueue(permissions: readonly PermissionCode[], items: unknown[] = [review]) {
  mockOrderApiGet(permissions, {
    "/orders/credit-holds": () => apiOrderPage([]),
    "/orders/contract-credit-reviews": () => page(items),
    [`/orders/credit-position/${CUSTOMER_ID}`]: () => apiCreditPosition,
  });
  renderOrderScreen(<CreditHoldList />);
}

async function openDecision(action: "Duyệt" | "Từ chối") {
  await userEvent.click(
    await screen.findByRole("button", { name: `Thao tác — ${review.contractNumber}` }),
  );
  await userEvent.click(await screen.findByRole("button", { name: action }));
  return screen.findByRole("dialog");
}

afterEach(() => vi.restoreAllMocks());

const TIMEOUT = 15_000;

describe("Hợp đồng chờ duyệt tín dụng trước khi gửi (15 BR-11, BE PR #486)", () => {
  it("Kế toán: dòng chờ hiện số hợp đồng, khách, lý do vượt hạn mức; mã đơn không là link (không có VIEW_PAGE đơn)", async () => {
    renderQueue(ORDER_PERMISSION_SETS.accountant);
    const row = (await screen.findByText(review.contractNumber)).closest("tr") as HTMLElement;
    expect(within(row).getByText("Công ty Ly Giấy Xanh")).toBeInTheDocument();
    expect(within(row).getByText(/vượt hạn mức/)).toBeInTheDocument();
    expect(within(row).queryByRole("link", { name: review.orderNumber })).not.toBeInTheDocument();
  });

  it(
    "Duyệt: ghi chú bắt buộc, gửi contractVersion của dòng + note",
    async () => {
      renderQueue(ORDER_PERMISSION_SETS.accountant);
      const post = vi
        .spyOn(api, "post")
        .mockResolvedValue({ data: { ...contractDraft, status: "SENT" } });
      const dialog = await openDecision("Duyệt");
      const confirm = within(dialog).getByRole("button", { name: "Duyệt và gửi" });
      expect(confirm).toBeDisabled();
      await userEvent.type(within(dialog).getByRole("textbox"), "Khách trả đều, cho qua.");
      await userEvent.click(confirm);
      await waitFor(() =>
        expect(post).toHaveBeenCalledWith(`/orders/${ORDER_ID}/contract/credit-review/approval`, {
          version: 3,
          note: "Khách trả đều, cho qua.",
        }),
      );
    },
    TIMEOUT,
  );

  it(
    "Duyệt bị PAYMENT_SCHEDULE_NEEDS_CREDIT → lỗi trong hộp thoại + hướng dẫn Từ chối",
    async () => {
      renderQueue(ORDER_PERMISSION_SETS.accountant);
      vi.spyOn(api, "post").mockRejectedValue(
        new ApiError(409, "PAYMENT_SCHEDULE_NEEDS_CREDIT", "Khách chưa có hạn mức tín dụng."),
      );
      const dialog = await openDecision("Duyệt");
      await userEvent.type(within(dialog).getByRole("textbox"), "ok");
      await userEvent.click(within(dialog).getByRole("button", { name: "Duyệt và gửi" }));
      expect(await within(dialog).findByText(/vẫn chờ duyệt — hãy Từ chối/)).toBeInTheDocument();
    },
    TIMEOUT,
  );

  it(
    "Từ chối gửi lý do tới /rejection",
    async () => {
      renderQueue(ORDER_PERMISSION_SETS.accountant);
      const post = vi.spyOn(api, "post").mockResolvedValue({ data: contractDraft });
      const dialog = await openDecision("Từ chối");
      await userEvent.type(within(dialog).getByRole("textbox"), "Giảm phần trả sau giao.");
      await userEvent.click(within(dialog).getByRole("button", { name: "Từ chối" }));
      await waitFor(() =>
        expect(post).toHaveBeenCalledWith(`/orders/${ORDER_ID}/contract/credit-review/rejection`, {
          version: 3,
          note: "Giảm phần trả sau giao.",
        }),
      );
    },
    TIMEOUT,
  );

  it("Sale (chỉ READ) thấy hàng chờ nhưng không có menu thao tác; mã đơn là link", async () => {
    renderQueue(ORDER_PERMISSION_SETS.salesStaff);
    expect(await screen.findByText(review.contractNumber)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: `Thao tác — ${review.contractNumber}` }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: review.orderNumber })).toBeInTheDocument();
  });

  it("Hàng chờ rỗng → thông báo trong bảng", async () => {
    renderQueue(ORDER_PERMISSION_SETS.accountant, []);
    expect(await screen.findByText("Không có hợp đồng chờ duyệt")).toBeInTheDocument();
  });
});
