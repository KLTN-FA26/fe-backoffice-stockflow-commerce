"use client";

import { ArrowLeft } from "lucide-react";
import { onlineManager } from "@tanstack/react-query";
import { use } from "react";

import { ADMIN_ROUTES, ORDER_PERMISSIONS } from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { formatDateTime } from "@/lib/format/date";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { PageHeader } from "@/components/shared/PageHeader";

import { useOrder, useOrderProductionOrders } from "../queries";
import { customLineCount, groupProductionOrdersByLine } from "../selectors";

import { OrderActionCard } from "./OrderActionCard";
import { HeaderLink } from "./HeaderLink";
import { OrderFinanceCard } from "./OrderFinanceCard";
import { OrderInfoCard } from "./OrderInfoCard";
import { OrderLines } from "./OrderLines";
import { OrderLoadError } from "./OrderLoadError";
import { OrderPermissionGate } from "./OrderPermissionGate";
import { LineProductionOrdersView, ProductionStatusNotice } from "./OrderProductionOrders";
import { OrderStatusHistory } from "./OrderStatusHistory";
import { OrderDetailSkeleton } from "./OrderSkeletons";

interface OrderDetailProps {
  params: Promise<{ id: string }>;
}

export function OrderDetail({ params }: OrderDetailProps) {
  const { id } = use(params);
  return (
    <OrderPermissionGate permissions={[ORDER_PERMISSIONS.viewPage]}>
      <OrderDetailContent id={id} />
    </OrderPermissionGate>
  );
}

function OrderDetailContent({ id }: { id: string }) {
  const can = usePermissionChecker();
  // READ = đọc dữ liệu (tách khỏi VIEW_PAGE mở trang — BE ADR-0004): thiếu thì không gọi API
  // UI-only — Backend phải re-check (@RequiresPermission sales-orders:READ trên OrderController)
  const canRead = can(ORDER_PERMISSIONS.read);
  const query = useOrder(id, { enabled: canRead });
  // Lệnh sản xuất chỉ có với dòng in (docs 19 BR-01) — đơn chỉ hàng sẵn không gọi API
  const hasCustomLines = !!query.data && customLineCount(query.data) > 0;
  const production = useOrderProductionOrders(id, { enabled: canRead && hasCustomLines });
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
  const productionState = production.isError
    ? "unavailable"
    : production.isPending
      ? "loading"
      : "ready";
  const subtitle = [order.recipientName, formatDateTime(order.placedAt)]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <PageHeader
        title={order.orderNumber}
        subtitle={subtitle}
        actions={
          <HeaderLink href={ADMIN_ROUTES.orders.list}>
            <ArrowLeft className="size-3.5" /> Quay lại
          </HeaderLink>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-5">
          <ProductionStatusNotice query={production} />
          <OrderLines
            lines={order.lines}
            currency={order.currency}
            renderCustomLineExtra={(line) => (
              <LineProductionOrdersView
                entry={productionByLine.get(line.lineId)}
                state={productionState}
              />
            )}
          />
          <OrderStatusHistory orderId={order.orderId} />
        </div>

        <div className="space-y-5">
          <OrderActionCard order={order} can={can} />
          <OrderInfoCard order={order} />
          <OrderFinanceCard order={order} />
        </div>
      </div>
    </>
  );
}
