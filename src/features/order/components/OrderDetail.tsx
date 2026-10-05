"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use } from "react";

import { ADMIN_ROUTES } from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { formatDateTime } from "@/lib/format/date";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { useOrder } from "../queries";

import { OrderActionCard } from "./OrderActionCard";
import { OrderDetailErrorState } from "./OrderDetailErrorState";
import { OrderFinanceCard } from "./OrderFinanceCard";
import { OrderInfoCard } from "./OrderInfoCard";
import { OrderLines } from "./OrderLines";

interface OrderDetailProps {
  params: Promise<{ id: string }>;
}

export function OrderDetail({ params }: OrderDetailProps) {
  const { id } = use(params);
  const can = usePermissionChecker();
  const query = useOrder(id);

  if (query.isLoading) return <PageSkeleton variant="detail" />;

  if (query.isError || !query.data) {
    return (
      <OrderDetailErrorState
        id={id}
        error={query.isError ? query.error : null}
        onRetry={() => query.refetch()}
      />
    );
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
