"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { onlineManager } from "@tanstack/react-query";
import { use } from "react";

import { ADMIN_ROUTES, ORDER_PERMISSIONS } from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { formatDateTime } from "@/lib/format/date";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { PageHeader } from "@/components/shared/PageHeader";

import { useOrder } from "../queries";

import { OrderActionCard } from "./OrderActionCard";
import { OrderFinanceCard } from "./OrderFinanceCard";
import { OrderInfoCard } from "./OrderInfoCard";
import { OrderLines } from "./OrderLines";
import { OrderLoadError } from "./OrderLoadError";
import { OrderPermissionGate } from "./OrderPermissionGate";
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
        actions={
          <Link
            href={ADMIN_ROUTES.orders.list}
            className="border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted hover:text-ink-primary inline-flex items-center gap-1.5 rounded-[var(--r-sm)] border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors"
          >
            <ArrowLeft className="size-3.5" /> Quay lại
          </Link>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <OrderLines lines={order.lines} currency={order.currency} />

        <div className="space-y-5">
          <OrderActionCard order={order} can={can} />
          <OrderInfoCard order={order} />
          <OrderFinanceCard order={order} />
        </div>
      </div>
    </>
  );
}
