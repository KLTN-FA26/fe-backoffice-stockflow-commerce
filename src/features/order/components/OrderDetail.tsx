"use client";

import { ArrowLeft, Box } from "lucide-react";
import Link from "next/link";
import { use, useState } from "react";

import { ADMIN_ROUTES } from "@/constants";
import { useAuthStore } from "@/lib/auth/auth-store";
import { toast } from "@/components/shared/Toast";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { StatusDot } from "@/components/shared/StatusDot";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";

import { adminCancelErrorView } from "../errors";
import { allowedOrderActions } from "../lifecycle";
import { useAdminCancelOrder } from "../mutations";
import { useOrder, useOrderEvents } from "../queries";

import { OrderEventTimeline } from "./OrderEventTimeline";
import { OrderFinanceCard } from "./OrderFinanceCard";
import { OrderInfoCard } from "./OrderInfoCard";
import { OrderLines } from "./OrderLines";

interface OrderDetailProps {
  params: Promise<{ id: string }>;
}

export function OrderDetail({ params }: OrderDetailProps) {
  const { id } = use(params);
  const roles = useAuthStore((s) => s.effectiveRoles());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const query = useOrder(id);
  const eventsQuery = useOrderEvents(id);
  const { mutate: adminCancel, isPending } = useAdminCancelOrder({
    onError: (error) => {
      const view = adminCancelErrorView(error);
      toast.error(view.title, view.detail);
    },
  });

  if (query.isLoading) return <PageSkeleton variant="detail" />;

  if (!query.data) {
    return (
      <>
        <PageHeader
          title="Không tìm thấy đơn hàng"
          subtitle="Đơn hàng không tồn tại hoặc đã bị xoá khỏi dữ liệu mock."
        />
        <div className="text-ink-tertiary flex flex-col items-center justify-center py-20">
          <Box className="mb-3 size-12 opacity-40" />
          <p className="text-[0.9375rem]">
            Đơn hàng <code className="text-accent font-[family-name:var(--font-mono)]">{id}</code>{" "}
            không tồn tại.
          </p>
          <Link
            href={ADMIN_ROUTES.orders.list}
            className="text-accent mt-4 text-[0.8125rem] hover:underline"
          >
            Quay lại danh sách
          </Link>
        </div>
      </>
    );
  }

  const order = query.data;
  const events = eventsQuery.data ?? [];
  const actions = allowedOrderActions(order.status, roles);
  const canCancel = actions.some((a) => a.code === "admin-cancel");

  return (
    <>
      <PageHeader
        title={order.orderNumber}
        subtitle={`${order.recipientName} · ${new Date(order.placedAt).toLocaleString("vi-VN")}`}
        actions={
          <div className="flex items-center gap-2">
            {canCancel && (
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => setConfirmOpen(true)}
                className="border-danger text-danger hover:bg-danger/10"
              >
                Huỷ đơn
              </Button>
            )}
            <StatusDot domain="order" status={order.status} size="sm" withIcon />
            <Link
              href={ADMIN_ROUTES.orders.list}
              className="border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted hover:text-ink-primary inline-flex items-center gap-1.5 rounded-[var(--r-sm)] border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              Quay lại
            </Link>
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <OrderLines lines={order.lines} />
          <OrderEventTimeline events={events} />
        </div>

        <div className="space-y-5">
          <OrderInfoCard order={order} />
          <OrderFinanceCard order={order} />
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Huỷ đơn hàng"
        description={`Huỷ đơn ${order.orderNumber}? Hành động này không thể hoàn tác.`}
        requireReason
        reasonLabel="Lý do huỷ"
        variant="danger"
        onConfirm={(reason) => {
          if (!reason) return;
          adminCancel({ id: order.orderId, reason });
        }}
      />
    </>
  );
}
