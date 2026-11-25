import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_ROUTES, CREDIT_PROFILE_PERMISSIONS, CUSTOMER_PERMISSIONS } from "@/constants";

import { mockOrderApiGet, renderOrderScreen } from "../__fixtures__/render";
import { OrderHoldNotice } from "./OrderHoldNotice";

import type { ComponentProps } from "react";
import type { PermissionCode } from "@/lib/auth";

const CREDIT_APPROVER: PermissionCode[] = [
  CUSTOMER_PERMISSIONS.viewPage,
  CREDIT_PROFILE_PERMISSIONS.read,
  CREDIT_PROFILE_PERMISSIONS.approve,
];

const held = {
  orderId: "o-1",
  customerId: "c-1",
  holdReason: "CREDIT" as const,
  holdReasonPublic: null,
  holdNote: null,
  statusBeforeHold: null,
};

function renderNotice(
  permissions: readonly PermissionCode[],
  order: ComponentProps<typeof OrderHoldNotice>["order"] = held,
) {
  mockOrderApiGet(permissions, {});
  renderOrderScreen(<OrderHoldNotice order={order} />);
}

afterEach(() => vi.restoreAllMocks());

describe("OrderHoldNotice — lối tắt hạn mức (AUTH-6)", () => {
  it("giữ vì công nợ + người duyệt hạn mức → link tới hộp sửa hạn mức, quay lại đơn", async () => {
    renderNotice(CREDIT_APPROVER);
    expect(await screen.findByRole("link", { name: "Sửa hạn mức công nợ" })).toHaveAttribute(
      "href",
      ADMIN_ROUTES.customers.creditProfile("c-1", ADMIN_ROUTES.orders.detail("o-1")),
    );
  });

  it("chỉ đọc hạn mức (không APPROVE) → không có link", async () => {
    renderNotice([CUSTOMER_PERMISSIONS.viewPage, CREDIT_PROFILE_PERMISSIONS.read]);
    await screen.findByText("Đơn đang tạm giữ");
    expect(screen.queryByRole("link", { name: "Sửa hạn mức công nợ" })).not.toBeInTheDocument();
  });

  it("giữ vì lý do khác → không có link dù có quyền", async () => {
    renderNotice(CREDIT_APPROVER, { ...held, holdReason: "PAYMENT" });
    await screen.findByText("Đơn đang tạm giữ");
    expect(screen.queryByRole("link", { name: "Sửa hạn mức công nợ" })).not.toBeInTheDocument();
  });
});
