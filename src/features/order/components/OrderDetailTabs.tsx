"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";

import { PageTabPanel, PageTabs } from "@/components/shared/PageTabs";

import { CancellationRequestCard } from "./cancellation/CancellationRequestCard";
import { CompletionHoldCard } from "./completion-hold/CompletionHoldCard";
import { OrderContractSection } from "./contract/OrderContractSection";
import { OrderDeliveryFailureSection } from "./delivery-failure/OrderDeliveryFailureSection";
import { DeliverySchedulePanel } from "./delivery-schedule/DeliverySchedulePanel";
import { OrderDeliveryDocuments } from "./OrderDeliveryDocuments";
import { OrderEstimateCard } from "./OrderEstimateCard";
import { OrderFinanceCard } from "./OrderFinanceCard";
import { OrderHistory } from "./OrderHistory";
import { OrderPartialShipmentCard } from "./OrderPartialShipmentCard";
import { OrderShipments } from "./OrderShipments";
import { OrderShippingWarehouseCard } from "./OrderShippingWarehouseCard";

import type { ReactNode } from "react";
import type { PermissionCode } from "@/lib/auth";
import type { OrderEstimateSlot } from "../estimate-slot";
import type { Order } from "../types";

export const ORDER_DETAIL_TABS = ["contract", "delivery", "payment", "returns", "history"] as const;
type TabKey = (typeof ORDER_DETAIL_TABS)[number];
const LABEL: Record<TabKey, string> = {
  contract: "Hợp đồng",
  delivery: "Giao hàng",
  payment: "Thanh toán",
  returns: "Trả hàng & huỷ",
  history: "Lịch sử",
};

/**
 * Các nhóm việc của đơn gom thành tab dưới bảng dòng hàng, như trang chi tiết sản phẩm (backoffice-erp-ui B12) — tab
 * đang chọn trên URL `?tab=`. "Hợp đồng" là tab đầu và mặc định (việc tiếp theo của đơn nháp, link "Lập hợp đồng" neo
 * `#contract`). Mỗi khối vẫn tự ẩn / hiện theo giai đoạn và quyền như trước; thẻ kho / giao hàng chỉ có sau hợp đồng.
 */
export function OrderDetailTabs({
  order,
  can,
  estimateSlot,
  fulfilmentStage,
  settlement,
  returns,
}: {
  order: Order;
  can: (code: PermissionCode) => boolean;
  estimateSlot?: OrderEstimateSlot;
  /** Đã qua hợp đồng ký — có việc kho / giao hàng. */
  fulfilmentStage: boolean;
  /** Khối "Thanh toán, hoá đơn & hoàn tất" do chỗ ghép truyền vào (`settlement-slot.ts`). */
  settlement: ReactNode;
  /** Khối "Trả hàng" do chỗ ghép truyền vào (`returns-slot.ts`). */
  returns: ReactNode;
}) {
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(ORDER_DETAIL_TABS).withDefault("contract"),
  );
  return (
    <>
      <PageTabs
        tabs={ORDER_DETAIL_TABS.map((value) => ({ value, label: LABEL[value] }))}
        value={tab}
        onChange={(next) => void setTab(next === "contract" ? null : next)}
        idPrefix="order-detail"
        ariaLabel="Thông tin đơn hàng"
      />
      <PageTabPanel idPrefix="order-detail" value={tab}>
        <div className="space-y-5">
          {tab === "contract" && <OrderContractSection order={order} can={can} />}
          {tab === "delivery" && (
            <>
              <DeliverySchedulePanel order={order} can={can} />
              <OrderDeliveryFailureSection order={order} can={can} />
              <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
                <OrderShippingWarehouseCard order={order} can={can} />
                {fulfilmentStage && (
                  <>
                    <CompletionHoldCard order={order} can={can} />
                    <OrderEstimateCard order={order} estimateSlot={estimateSlot} />
                    <OrderPartialShipmentCard order={order} can={can} />
                  </>
                )}
              </div>
              {fulfilmentStage && (
                <>
                  <OrderShipments order={order} />
                  <OrderDeliveryDocuments orderId={order.orderId} />
                </>
              )}
            </>
          )}
          {tab === "payment" && (
            <>
              <OrderFinanceCard order={order} can={can} />
              {settlement}
            </>
          )}
          {tab === "returns" && (
            <>
              <CancellationRequestCard order={order} can={can} />
              {returns}
            </>
          )}
          {tab === "history" && <OrderHistory orderId={order.orderId} bare />}
        </div>
      </PageTabPanel>
    </>
  );
}
