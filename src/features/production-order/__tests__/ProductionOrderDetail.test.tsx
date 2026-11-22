import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DELAY_ALERT_LABELS, PRODUCTION_LABELS } from "@/constants";

import { ProductionOrderDetail } from "../components/ProductionOrderDetail";
import {
  bePage,
  COORDINATOR_ID,
  MANAGER_ID,
  PRODUCTION_ACTORS,
  producerDto,
  productionOrder,
} from "../__fixtures__/production-order";
import { pickDate } from "@/test/date-picker";
import { mockProductionApi, renderProductionScreen } from "@/test/production-screen";
import { sampleRounds } from "../__fixtures__/sample-rounds";

import type { PermissionCode } from "@/lib/auth";
import type { ProductionOrder } from "../types";

const A = PRODUCTION_LABELS.actions;
const D = PRODUCTION_LABELS.dialogs;
const ID = productionOrder().id;
const URL = `/production-orders/${ID}`;
// Ngày dự kiến không được ở quá khứ — lấy ngày 15 của năm sau
const EXPECTED = `${new Date().getFullYear() + 1}-01-15`;

function setup(
  order: ProductionOrder,
  permissions: readonly PermissionCode[],
  userId: string,
  alerts: unknown[] = [],
) {
  const apiSpies = mockProductionApi(permissions, {
    get: {
      [URL]: () => order,
      "/delay-alerts": () => bePage(alerts),
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
      [`${URL}/sample-rounds`]: () =>
        sampleRounds({ status: order.status, rounds: [], waitingRoundId: null }),
    },
    post: {
      [`${URL}/sending`]: () => ({ ...order, status: "SENT", sentAt: "2026-11-20T03:00:00Z" }),
      [`${URL}/acceptance`]: () => ({ ...order, status: "ACCEPTED" }),
    },
  });
  renderProductionScreen(<ProductionOrderDetail id={ID} />, userId);
  return apiSpies;
}

const actionsCard = () => screen.getByRole("region", { name: A.title, hidden: false });

afterEach(() => vi.restoreAllMocks());

describe("ProductionOrderDetail — action-gating (docs 17 §5.3, BR-23 chốt lại 2026-11-20)", () => {
  it("Draft + Điều phối sản xuất (chính người lập) → Gửi cho đơn vị sản xuất, Sửa nháp, Huỷ đơn", async () => {
    setup(productionOrder(), PRODUCTION_ACTORS.coordinator, COORDINATOR_ID);
    expect(await screen.findByRole("button", { name: A.send })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: A.edit })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: A.cancel })).toBeInTheDocument();
    expect(await screen.findByText("SO-2026-0042")).toBeInTheDocument();
  });

  it("Gửi → POST /sending đúng version, không qua bước duyệt", async () => {
    const user = userEvent.setup();
    const { post } = setup(productionOrder(), PRODUCTION_ACTORS.coordinator, COORDINATOR_ID);
    await user.click(await screen.findByRole("button", { name: A.send }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: A.send }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(`${URL}/sending`, { version: 3 }));
  });

  it("Sent → Ghi nhận nhận đơn gửi ngày dự kiến + ghi chú đã cắt khoảng trắng", async () => {
    const user = userEvent.setup();
    const { post } = setup(
      productionOrder({ status: "SENT", sentAt: "2026-11-20T03:00:00Z", sentBy: COORDINATOR_ID }),
      PRODUCTION_ACTORS.coordinator,
      COORDINATOR_ID,
    );
    await user.click(await screen.findByRole("button", { name: A.accept }));
    const dialog = await screen.findByRole("dialog");
    await pickDate(user, within(dialog).getByLabelText(new RegExp(D.expectedDate)), EXPECTED);
    await user.type(
      within(dialog).getByLabelText(new RegExp(D.acceptNote)),
      "  anh Hùng xác nhận qua Zalo  ",
    );
    await user.click(within(dialog).getByRole("button", { name: D.confirm }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`${URL}/acceptance`, {
        version: 3,
        expectedCompletionDate: EXPECTED,
        note: "anh Hùng xác nhận qua Zalo",
      }),
    );
  });

  it("Draft + Sales Manager → chỉ xem, không có nút thao tác nào", async () => {
    setup(productionOrder(), PRODUCTION_ACTORS.salesManager, MANAGER_ID);
    await screen.findByText(productionOrder().code);
    expect(within(actionsCard()).queryAllByRole("button")).toHaveLength(0);
  });

  it("Sent + Sale (chỉ đọc) → không nút thao tác nào", async () => {
    setup(productionOrder({ status: "SENT" }), PRODUCTION_ACTORS.sales, "sale");
    await screen.findByText(productionOrder().code);
    expect(within(actionsCard()).queryAllByRole("button")).toHaveLength(0);
  });

  it("Đơn đã nhận hiện người gửi và ghi chú khi nhận đơn", async () => {
    setup(
      productionOrder({
        status: "ACCEPTED",
        sentAt: "2026-11-20T03:00:00Z",
        sentBy: COORDINATOR_ID,
        expectedCompletionDate: "2026-12-05",
        acceptanceNote: "Chị Lan xác nhận qua email",
      }),
      PRODUCTION_ACTORS.salesManager,
      MANAGER_ID,
    );
    expect(await screen.findByText("Chị Lan xác nhận qua email")).toBeInTheDocument();
    expect(screen.getByText(PRODUCTION_LABELS.detail.sentBy)).toBeInTheDocument();
  });

  it("Điều phối sản xuất thấy cảnh báo trễ của Đơn sản xuất (BE V20261209000400)", async () => {
    const order = productionOrder({ status: "ACCEPTED", expectedCompletionDate: "2026-12-20" });
    const alert = {
      id: "alert-1",
      type: "AT_RISK",
      open: true,
      salesOrderId: order.salesOrderId,
      productionOrderId: order.id,
      productionOrderCode: order.code,
      openedAt: "2026-11-20T03:00:00Z",
    };
    setup(order, PRODUCTION_ACTORS.coordinator, COORDINATOR_ID, [alert]);
    const panel = await screen.findByRole("region", { name: PRODUCTION_LABELS.alerts.orderTitle });
    expect(within(panel).getByText(DELAY_ALERT_LABELS.AT_RISK)).toBeInTheDocument();
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

  it("BR-25: vượt sức chứa → banner cảnh báo nhưng vẫn gửi được", async () => {
    const base = productionOrder();
    const capacity = base.capacity
      ? { ...base.capacity, exceedsProjected: true, shortfallM3: 1.5 }
      : null;
    setup(productionOrder({ capacity }), PRODUCTION_ACTORS.coordinator, COORDINATOR_ID);
    expect(await screen.findByText(PRODUCTION_LABELS.detail.capacityTitle)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: A.send })).toBeEnabled();
  });
});
