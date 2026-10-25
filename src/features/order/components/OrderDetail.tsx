"use client";

import { onlineManager } from "@tanstack/react-query";
import { use } from "react";

import { ADMIN_ROUTES, ORDER_PERMISSIONS } from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { formatDateTime } from "@/lib/format/date";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { PageHeader } from "@/components/shared/PageHeader";
import { BackLink } from "@/components/shared/BackLink";

import { useOrder } from "../queries";

import { OrderActionCard } from "./OrderActionCard";
import { OrderDeliveryModeCard } from "./OrderDeliveryModeCard";
import { OrderFinanceCard } from "./OrderFinanceCard";
import { OrderInfoCard } from "./OrderInfoCard";
import { OrderHistory } from "./OrderHistory";
import { OrderLines } from "./OrderLines";
import { OrderLoadError } from "./OrderLoadError";
import { OrderPartialShipmentCard } from "./OrderPartialShipmentCard";
import { OrderPermissionGate } from "./OrderPermissionGate";
import { OrderShipments } from "./OrderShipments";
import { OrderDetailSkeleton } from "./OrderSkeletons";

import type { OrderEstimateSlot } from "../estimate-slot";

interface OrderDetailProps {
  params: Promise<{ id: string }>;
  /** Khe "Ước tính xếp xe" do chỗ ghép truyền vào (feature không import chéo — xem `estimate-slot.ts`). */
  estimateSlot?: OrderEstimateSlot;
}

export function OrderDetail({ params, estimateSlot }: OrderDetailProps) {
  const { id } = use(params);
  return (
    <OrderPermissionGate permissions={[ORDER_PERMISSIONS.viewPage]}>
      <OrderDetailContent id={id} estimateSlot={estimateSlot} />
    </OrderPermissionGate>
  );
}

function OrderDetailContent({
  id,
  estimateSlot,
}: {
  id: string;
  estimateSlot?: OrderEstimateSlot;
}) {
  const can = usePermissionChecker();
  // READ = đọc dữ liệu (tách khỏi VIEW_PAGE mở trang — BE ADR-0004): thiếu thì không gọi API
  const canRead = can(ORDER_PERMISSIONS.read);
  const query = useOrder(id, { enabled: canRead });
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
  const subtitle = [order.recipientName, formatDateTime(order.placedAt)]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <PageHeader
        title={order.orderNumber}
        subtitle={subtitle}
        actions={<BackLink href={ADMIN_ROUTES.orders.list} />}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <OrderLines
            lines={order.lines}
            currency={order.currency}
            hasShipments={order.shipments.length > 0}
          />
          <OrderHistory orderId={order.orderId} />
        </div>

        <div className="space-y-5">
          <OrderActionCard order={order} can={can} estimateSlot={estimateSlot} />
          <OrderDeliveryModeCard order={order} can={can} estimateSlot={estimateSlot} />
          <OrderPartialShipmentCard order={order} can={can} />
          <OrderShipments order={order} />
          <OrderInfoCard order={order} />
          <OrderFinanceCard order={order} />
        </div>
      </div>
    </>
  );
}
