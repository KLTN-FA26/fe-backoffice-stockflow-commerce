"use client";

import { onlineManager } from "@tanstack/react-query";
import { use } from "react";

import {
  ADMIN_ROUTES,
  ORDER_PERMISSIONS,
  PRODUCTION_ORDER_PERMISSIONS,
  SALES_CONTRACT_PERMISSIONS,
} from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { formatDateTime } from "@/lib/format/date";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { DelayAlertsPanel } from "@/components/backoffice/DelayAlertsPanel";
import { PageHeader } from "@/components/shared/PageHeader";
import { BackLink } from "@/components/shared/BackLink";

import { useCompletionHold } from "../completion-hold-queries";
import { useOrder, useOrderProductionOrders } from "../queries";
import { useSalesContract } from "../sales-contract-queries";
import { customLineCount, groupProductionOrdersByLine, isPastContract } from "../selectors";

import { CancellationRequestCard } from "./cancellation/CancellationRequestCard";
import { CompletionHoldCard } from "./completion-hold/CompletionHoldCard";
import { OrderContractSection } from "./contract/OrderContractSection";
import { OrderDeliveryFailureSection } from "./delivery-failure/OrderDeliveryFailureSection";
import { DeliverySchedulePanel } from "./delivery-schedule/DeliverySchedulePanel";
import { OrderActionCard } from "./OrderActionCard";
import { OrderEstimateCard } from "./OrderEstimateCard";
import { OrderFinanceCard } from "./OrderFinanceCard";
import { OrderInfoCard } from "./OrderInfoCard";
import { OrderHistory } from "./OrderHistory";
import { OrderLines } from "./OrderLines";
import { OrderLoadError } from "./OrderLoadError";
import { OrderPartialShipmentCard } from "./OrderPartialShipmentCard";
import { OrderPermissionGate } from "./OrderPermissionGate";
import { OrderShippingWarehouseCard } from "./OrderShippingWarehouseCard";
import { LineProductionOrdersView, ProductionStatusNotice } from "./OrderProductionOrders";
import { OrderDeliveryDocuments } from "./OrderDeliveryDocuments";
import { OrderShipments } from "./OrderShipments";
import { OrderDetailSkeleton } from "./OrderSkeletons";

import type { OrderEstimateSlot } from "../estimate-slot";
import type { OrderReturnsSlot } from "../returns-slot";
import type { OrderSettlementSlot } from "../settlement-slot";

interface OrderDetailProps {
  params: Promise<{ id: string }>;
  /** Khe "Ước tính xếp xe" do chỗ ghép truyền vào (feature không import chéo — xem `estimate-slot.ts`). */
  estimateSlot?: OrderEstimateSlot;
  /** Khe "Thanh toán, hoá đơn & hoàn tất" (WF-05 BO-10 — xem `settlement-slot.ts`). */
  settlementSlot?: OrderSettlementSlot;
  /** Khe "Trả hàng" (WF-05 BO-13 — xem `returns-slot.ts`). */
  returnsSlot?: OrderReturnsSlot;
}

export function OrderDetail({
  params,
  estimateSlot,
  settlementSlot,
  returnsSlot,
}: OrderDetailProps) {
  const { id } = use(params);
  return (
    <OrderPermissionGate permissions={[ORDER_PERMISSIONS.viewPage]}>
      <OrderDetailContent
        id={id}
        estimateSlot={estimateSlot}
        settlementSlot={settlementSlot}
        returnsSlot={returnsSlot}
      />
    </OrderPermissionGate>
  );
}

function OrderDetailContent({
  id,
  estimateSlot,
  settlementSlot,
  returnsSlot,
}: {
  id: string;
  estimateSlot?: OrderEstimateSlot;
  settlementSlot?: OrderSettlementSlot;
  returnsSlot?: OrderReturnsSlot;
}) {
  const can = usePermissionChecker();
  // READ = đọc dữ liệu (tách khỏi VIEW_PAGE mở trang — BE ADR-0004): thiếu thì không gọi API
  // UI-only — Backend phải re-check (@RequiresPermission sales-orders:READ trên OrderController)
  const canRead = can(ORDER_PERMISSIONS.read);
  const query = useOrder(id, { enabled: canRead });
  // Đơn sản xuất chỉ có với dòng in (docs 17 §4.3) — đơn chỉ hàng sẵn không gọi API.
  // UI-only — Backend phải re-check (@RequiresPermission production-orders:READ, ProductionOrderController)
  const canReadProduction = can(PRODUCTION_ORDER_PERMISSIONS.read);
  const hasCustomLines = !!query.data && customLineCount(query.data) > 0;
  // Lọc theo `orderId` của BE (UUID) — đơn đã tải xong mới gọi
  const production = useOrderProductionOrders(query.data?.orderId ?? "", {
    enabled: canRead && canReadProduction && hasCustomLines,
  });
  // WF-05: hạn đổi / trả theo hợp đồng cho thẻ "Trả hàng" (cùng query key với khối Hợp đồng — không gọi thêm)
  const contract = useSalesContract(
    query.data?.orderId ?? "",
    canRead && can(SALES_CONTRACT_PERMISSIONS.read) && !!query.data,
  );
  // WF-05 GH-2: cùng key với thẻ "Giữ hoàn tất" (không gọi thêm) — điều kiện tự hoàn tất của khối thanh toán
  const completionHold = useCompletionHold(query.data?.orderId ?? "", {
    enabled: canRead && !!query.data,
  });
  // Breadcrumb hiện mã đơn (SO-…) thay vì orderId (UUID của BE), như NCC
  useBreadcrumbLabel(id, query.data?.orderNumber);

  if (!canRead) return <OrderLoadError error={null} kind="no-read" />;

  // isPending (không dùng isLoading): retry bị tạm dừng khi cửa sổ mất focus → query vẫn pending
  // nhưng fetchStatus "paused"; dùng isLoading sẽ rơi xuống nhánh lỗi và hiện nhầm "không tìm thấy".
  if (query.isPending) {
    if (query.fetchStatus === "paused" && !onlineManager.isOnline()) {
      return <OrderLoadError error={null} kind="network" onRetry={() => void query.refetch()} />;
    }
    return <OrderDetailSkeleton />;
  }

  if (query.isError) {
    return <OrderLoadError error={query.error} onRetry={() => void query.refetch()} />;
  }

  const order = query.data;
  const productionByLine = groupProductionOrdersByLine(production.data ?? []);
  const productionState =
    !canReadProduction || production.isError
      ? "unavailable"
      : production.isPending
        ? "loading"
        : "ready";
  // BO-UX-22: công ty khách ở phần đầu trang (người nhận hàng nằm ở thẻ Thông tin).
  const subtitle = [order.customerName ?? order.recipientName, formatDateTime(order.placedAt)]
    .filter(Boolean)
    .join(" · ");
  // Trước khi có hợp đồng ký, đơn chưa có việc kho / giao: không hiện các thẻ đó (giữ hoàn tất, giao một phần, vận đơn).
  const fulfilmentStage = isPastContract(order.status);

  return (
    <>
      <PageHeader
        title={order.orderNumber}
        subtitle={subtitle}
        actions={<BackLink href={ADMIN_ROUTES.orders.list} />}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          {/* Cờ trễ của đơn (docs 17 §4.12 bước 49) — không chặn thao tác nào */}
          <DelayAlertsPanel salesOrderId={order.orderId} />
          {hasCustomLines && (
            <ProductionStatusNotice query={production} canRead={canReadProduction} />
          )}
          <OrderLines
            lines={order.lines}
            currency={order.currency}
            hasShipments={order.shipments.length > 0}
            renderCustomLineExtra={(line) => (
              <LineProductionOrdersView
                entry={productionByLine.get(line.lineId)}
                state={productionState}
              />
            )}
          />
          <OrderContractSection order={order} can={can} />
          <DeliverySchedulePanel order={order} can={can} />
          <OrderDeliveryFailureSection order={order} can={can} />
          {settlementSlot?.({
            orderId: order.orderId,
            orderNumber: order.orderNumber,
            status: order.status,
            deliveredAt: order.deliveredAt ?? null,
            completedAt: order.completedAt ?? null,
            closedAt: order.closedAt ?? null,
            deliveredShipmentIds: order.shipments
              .filter((shipment) => shipment.status === "DELIVERED")
              .map((shipment) => shipment.shipmentId),
            completionHeld: completionHold.isSuccess ? completionHold.data !== null : null,
          })}
          {returnsSlot?.({
            orderId: order.orderId,
            orderNumber: order.orderNumber,
            status: order.status,
            deliveredAt: order.deliveredAt ?? null,
            lines: order.lines.map((line) => ({
              lineId: line.lineId,
              sku: line.sku,
              deliveredQuantity:
                line.deliveredQuantity ?? line.quantity - (line.cancelledQuantity ?? 0),
              customPrinted: line.isCustom,
            })),
            shipments: order.shipments
              .filter((shipment) => shipment.status === "DELIVERED")
              .map((shipment) => ({
                shipmentId: shipment.shipmentId,
                deliveredAt: shipment.outcomeAt ?? null,
                lines: shipment.lines,
              })),
            returnWindowDays:
              contract.data && contract.data.status !== "CANCELLED"
                ? (contract.data.returnWindowDays ?? null)
                : null,
          })}
          <OrderHistory orderId={order.orderId} />
        </div>

        <div className="space-y-5">
          {/* BO-UX-22: trạng thái + việc tiếp theo, rồi khách và tiền, rồi kho / giao hàng / chứng từ. */}
          <OrderActionCard order={order} can={can} estimateSlot={estimateSlot} />
          <CancellationRequestCard order={order} can={can} />
          <OrderInfoCard order={order} can={can} />
          <OrderFinanceCard order={order} can={can} />
          <OrderShippingWarehouseCard order={order} can={can} />
          {fulfilmentStage && (
            <>
              <CompletionHoldCard order={order} can={can} />
              <OrderEstimateCard order={order} estimateSlot={estimateSlot} />
              <OrderPartialShipmentCard order={order} can={can} />
              <OrderShipments order={order} />
              <OrderDeliveryDocuments orderId={order.orderId} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
