import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PRODUCTION_LABELS } from "@/constants";

import { ProductionOrderDetail } from "../components/ProductionOrderDetail";
import {
  bePage,
  COORDINATOR_ID,
  MANAGER_ID,
  PRODUCTION_ACTORS,
  producerDto,
  productionOrder,
} from "../__fixtures__/production-order";
import { mockProductionApi, renderProductionScreen } from "@/test/production-screen";

import type { PermissionCode } from "@/lib/auth";
import type { ProductionOrder } from "../types";

const A = PRODUCTION_LABELS.actions;
const ID = productionOrder().id;
const URL = `/production-orders/${ID}`;

function setup(order: ProductionOrder, permissions: readonly PermissionCode[], userId: string) {
  const apiSpies = mockProductionApi(permissions, {
    get: {
      [URL]: () => order,
      "/producers": () => bePage([producerDto]),
      [`/orders/${order.salesOrderId}/delivery-batches`]: () => ({
        orderId: order.salesOrderId,
        orderNumber: "SO-2026-0042",
        batches: [
          {
            batchId: order.deliveryBatchId,
            seq: 2,
            windowStart: "2026-12-10",
            windowEnd: "2026-12-15",
          },
        ],
      }),
      [`${URL}/dispatch`]: () => ({ channel: "EMAIL", messages: bePage([]) }),
    },
    post: {
      [`${URL}/approval`]: () => ({ ...order, status: "SENT" }),
      [`${URL}/submission`]: () => ({ ...order, status: "PENDING_APPROVAL" }),
    },
  });
  renderProductionScreen(<ProductionOrderDetail id={ID} />, userId);
  return apiSpies;
}

const actionsCard = () => screen.getByRole("region", { name: A.title, hidden: false });

afterEach(() => vi.restoreAllMocks());

describe("ProductionOrderDetail — action-gating (docs 17 §5.3)", () => {
  it("Draft + Điều phối sản xuất → Gửi duyệt, Sửa nháp, Huỷ đơn; không Duyệt", async () => {
    setup(productionOrder(), PRODUCTION_ACTORS.coordinator, COORDINATOR_ID);
    expect(await screen.findByRole("button", { name: A.submit })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: A.edit })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: A.cancel })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: A.approve })).not.toBeInTheDocument();
    expect(await screen.findByText("SO-2026-0042")).toBeInTheDocument();
  });

  it("BR-23: Pending Approval + Sales Manager tự lập → không thấy Duyệt, có giải thích", async () => {
    setup(
      productionOrder({ status: "PENDING_APPROVAL", drawnUpBy: MANAGER_ID }),
      PRODUCTION_ACTORS.salesManager,
      MANAGER_ID,
    );
    expect(await screen.findByText(A.selfApprovalHint)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: A.approve })).not.toBeInTheDocument();
  });

  it("Pending Approval + Sales Manager khác người lập → Duyệt gửi đúng version", async () => {
    const user = userEvent.setup();
    const { post } = setup(
      productionOrder({ status: "PENDING_APPROVAL" }),
      PRODUCTION_ACTORS.salesManager,
      MANAGER_ID,
    );
    await user.click(await screen.findByRole("button", { name: A.approve }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: A.approve }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(`${URL}/approval`, { version: 3 }));
  });

  it("Pending Approval + Sale (chỉ đọc) → không nút thao tác nào", async () => {
    setup(productionOrder({ status: "PENDING_APPROVAL" }), PRODUCTION_ACTORS.sales, "sale");
    await screen.findByText(productionOrder().code);
    for (const label of [A.approve, A.return, A.cancel, A.submit]) {
      expect(screen.queryByRole("button", { name: label })).not.toBeInTheDocument();
    }
  });

  it("Closed → không render nút mutating nào", async () => {
    setup(
      productionOrder({
        status: "CLOSED",
        closingReason: "Xưởng dừng",
        sentAt: "2026-11-20T03:00:00Z",
      }),
      PRODUCTION_ACTORS.coordinator,
      COORDINATOR_ID,
    );
    expect(await screen.findByText("Xưởng dừng")).toBeInTheDocument();
    expect(within(actionsCard()).queryAllByRole("button")).toHaveLength(0);
  });

  it("BR-25: vượt sức chứa → banner cảnh báo nhưng vẫn gửi duyệt được", async () => {
    const base = productionOrder();
    const capacity = base.capacity
      ? { ...base.capacity, exceedsProjected: true, shortfallM3: 1.5 }
      : null;
    setup(productionOrder({ capacity }), PRODUCTION_ACTORS.coordinator, COORDINATOR_ID);
    expect(await screen.findByText(PRODUCTION_LABELS.detail.capacityTitle)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: A.submit })).toBeEnabled();
  });
});
