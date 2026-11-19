import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DELAY_ALERT_LABELS, DELAY_ALERT_PERMISSIONS, PRODUCTION_LABELS } from "@/constants";
import { mockProductionApi, renderProductionScreen } from "@/test/production-screen";

import { DelayAlertsPanel } from "./DelayAlertsPanel";

import type { PermissionCode } from "@/lib/auth";

const L = PRODUCTION_LABELS.alerts;
const SALES = [DELAY_ALERT_PERMISSIONS.read] as PermissionCode[];
const page = (items: unknown[]) => ({
  items,
  page: 0,
  size: 200,
  totalElements: items.length,
  totalPages: 1,
  hasNext: false,
  hasPrevious: false,
});
const alerts = [
  {
    id: "a1",
    type: "AT_RISK",
    open: true,
    salesOrderId: "so-1",
    productionOrderId: "po-1",
    productionOrderCode: "PRD-20261120-0001",
    openedAt: "2026-11-19T01:00:00Z",
  },
  {
    id: "a2",
    type: "DELIVERY_LATE",
    open: true,
    salesOrderId: "so-1",
    deliveryBatchId: "b2",
    deliveryBatchSeq: 2,
    openedAt: "2026-11-20T01:00:00Z",
  },
];

afterEach(() => vi.restoreAllMocks());

describe("DelayAlertsPanel — cờ trễ trên trang đơn (docs 17 §4.12 bước 49)", () => {
  it("Sale thấy cờ đang mở của đơn, trễ thật trước nguy cơ, kèm chủ thể", async () => {
    const { get } = mockProductionApi(SALES, { get: { "/delay-alerts": () => page(alerts) } });
    renderProductionScreen(<DelayAlertsPanel salesOrderId="so-1" />);
    const items = await screen.findAllByRole("listitem");
    expect(items[0]).toHaveTextContent(DELAY_ALERT_LABELS.DELIVERY_LATE);
    expect(items[0]).toHaveTextContent(L.batch(2));
    expect(items[1]).toHaveTextContent(L.productionOrder("PRD-20261120-0001"));
    expect(get).toHaveBeenCalledWith(
      "/delay-alerts",
      expect.objectContaining({
        params: expect.objectContaining({ salesOrderId: "so-1", open: true }),
      }),
    );
  });

  it("trên chi tiết Đơn sản xuất chỉ hiện cờ của chính Đơn sản xuất đó", async () => {
    mockProductionApi(SALES, { get: { "/delay-alerts": () => page(alerts) } });
    renderProductionScreen(<DelayAlertsPanel salesOrderId="so-1" productionOrderId="po-1" />);
    expect(await screen.findByText(DELAY_ALERT_LABELS.AT_RISK)).toBeInTheDocument();
    expect(screen.queryByText(DELAY_ALERT_LABELS.DELIVERY_LATE)).not.toBeInTheDocument();
  });

  it("Điều phối sản xuất (không có delay-alerts:READ) → không gọi API, không chiếm chỗ", async () => {
    const { get } = mockProductionApi([], { get: {} });
    const { container } = renderProductionScreen(<DelayAlertsPanel salesOrderId="so-1" />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(get.mock.calls.some(([url]) => url === "/delay-alerts")).toBe(false);
    expect(container).toBeEmptyDOMElement();
  });

  it("lỗi tải → báo + Thử lại, không im lặng", async () => {
    mockProductionApi(SALES, {
      get: {
        "/delay-alerts": () => {
          throw new Error("down");
        },
      },
    });
    renderProductionScreen(<DelayAlertsPanel salesOrderId="so-1" />);
    expect(await screen.findByText(L.loadFailed)).toBeInTheDocument();
  });
});
