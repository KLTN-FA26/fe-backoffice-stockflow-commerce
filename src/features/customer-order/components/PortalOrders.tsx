"use client";

import Link from "next/link";
import { parseAsInteger, useQueryState } from "nuqs";
import { PackageOpen } from "lucide-react";

import { ORDER_PERMISSIONS, PORTAL_ROUTES } from "@/constants";

import { useCan } from "@/lib/auth";
import { formatDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";

import { useMyOrders } from "@/features/customer-order/queries";
import { statusGroupDisplay } from "@/features/customer-order/selectors";

import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import { COPY, MONO } from "./portal-copy";

export function PortalOrderList() {
  const canRead = useCan(ORDER_PERMISSIONS.read);
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const query = useMyOrders({ page: Math.max(0, page - 1), size: 10 }, { enabled: canRead });
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Đơn hàng</h1>
        <p className="text-ink-secondary">Theo dõi tiến độ đơn hàng của doanh nghiệp bạn.</p>
      </div>
      {!canRead ? (
        <LoadErrorState inline error={null} kind="no-read" copy={COPY} />
      ) : query.isError ? (
        <LoadErrorState
          inline
          error={query.error}
          copy={COPY}
          onRetry={() => void query.refetch()}
        />
      ) : query.isPending ? (
        <PageSkeleton variant="list" />
      ) : query.data.totalElements === 0 ? (
        <EmptyState
          icon={<PackageOpen className="size-8" />}
          title="Chưa có đơn hàng"
          description="Đơn được tạo khi bạn chấp nhận báo giá và Sales xác nhận."
          action={
            <Button asChild variant="outline" className="min-h-11">
              <Link href={PORTAL_ROUTES.quotes.list}>Xem báo giá</Link>
            </Button>
          }
        />
      ) : (
        <>
          <ul className="space-y-3">
            {query.data.items.map((order) => (
              <li key={order.orderId}>
                <Link
                  href={PORTAL_ROUTES.orders.detail(order.orderId)}
                  className="bg-bg-surface border-border-default focus-visible:ring-brand flex min-h-11 flex-wrap items-center gap-x-6 gap-y-2 rounded-[var(--r-lg)] border p-5 shadow-[var(--sh-md)] focus-visible:ring-2 focus-visible:outline-none"
                >
                  <span className={`font-semibold ${MONO}`}>{order.orderNumber}</span>
                  <StatusDot domain="order" status={statusGroupDisplay(order.statusGroup)} />
                  <span className="text-ink-secondary text-sm">
                    {formatDate(order.placedAt)} · {order.lineCount} dòng
                  </span>
                  <span className={`ml-auto font-semibold ${MONO}`}>
                    {formatMoney(order.total, order.currency)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <nav aria-label="Phân trang đơn hàng" className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              className="min-h-11"
              disabled={!query.data.hasPrevious}
              onClick={() => void setPage(page - 1)}
            >
              Trang trước
            </Button>
            <span className="text-ink-secondary text-sm tabular-nums">
              Trang {query.data.page + 1} / {Math.max(1, query.data.totalPages)}
            </span>
            <Button
              variant="outline"
              className="min-h-11"
              disabled={!query.data.hasNext}
              onClick={() => void setPage(page + 1)}
            >
              Trang sau
            </Button>
          </nav>
        </>
      )}
    </div>
  );
}
