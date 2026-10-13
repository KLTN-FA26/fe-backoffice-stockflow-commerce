"use client";

import { useState } from "react";
import Link from "next/link";
import { parseAsInteger, useQueryState } from "nuqs";
import { ArrowLeft, PackageOpen, RotateCcw } from "lucide-react";

import { ORDER_PERMISSIONS, PORTAL_ROUTES } from "@/constants";
import { useCan } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { formatNumber } from "@/lib/format/number";
import { myOrderErrorMessage } from "@/features/customer-order/errors";
import { useReorder } from "@/features/customer-order/mutations";
import { useMyOrder, useMyOrders } from "@/features/customer-order/queries";
import { STATUS_GROUP_DISPLAY } from "@/features/customer-order/schemas";
import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import type { LoadErrorCopy } from "@/components/backoffice/LoadErrorState";

const COPY: LoadErrorCopy = {
  pageTitle: "Đơn hàng",
  notFoundTitle: "Không tìm thấy đơn hàng",
  notFoundDescription: "Đơn hàng không tồn tại hoặc không thuộc doanh nghiệp của bạn.",
  forbiddenDescription: "Tài khoản chưa được cấp quyền xem đơn hàng.",
  noReadDescription: "Tài khoản chưa được cấp quyền xem đơn hàng.",
};
const MONO = "font-[family-name:var(--font-mono)] tabular-nums";
const PRODUCTION_STATE: Readonly<Record<string, string>> = {
  NOT_STARTED: "Chưa in",
  IN_PROGRESS: "Đang in",
  DONE: "In xong",
  CANCELLED: "Đã huỷ in",
};

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
                  <StatusDot domain="order" status={STATUS_GROUP_DISPLAY[order.statusGroup]} />
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

/** Chi tiết đơn của khách: dòng thời gian thật từ BE (SCRUM-248), đặt lại → yêu cầu báo giá (R1b). */
export function PortalOrderDetail({ id }: { id: string }) {
  const canRead = useCan(ORDER_PERMISSIONS.read);
  const query = useMyOrder(id, { enabled: canRead });
  const reorder = useReorder();
  const [requestId] = useState(() => crypto.randomUUID());
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const back = { href: PORTAL_ROUTES.orders.list, label: "Về danh sách đơn" };
  if (!canRead) return <LoadErrorState error={null} kind="no-read" copy={COPY} back={back} />;
  if (query.isError)
    return (
      <LoadErrorState
        error={query.error}
        copy={COPY}
        back={back}
        onRetry={() => void query.refetch()}
      />
    );
  if (query.isPending) return <PageSkeleton variant="detail" />;
  const order = query.data;

  return (
    <div className="space-y-6">
      <Link
        href={PORTAL_ROUTES.orders.list}
        className="text-ink-secondary inline-flex min-h-11 items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Đơn hàng
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className={`text-2xl font-bold ${MONO}`}>{order.orderNumber}</h1>
        <StatusDot domain="order" status={STATUS_GROUP_DISPLAY[order.statusGroup]} size="md" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section
          aria-labelledby="order-lines"
          className="bg-bg-surface border-border-default space-y-3 rounded-[var(--r-lg)] border p-6"
        >
          <h2 id="order-lines" className="font-semibold">
            Hàng đặt
          </h2>
          <ul className="divide-border-default divide-y text-sm">
            {order.lines.map((line) => (
              <li
                key={line.lineId}
                className="flex flex-wrap items-baseline justify-between gap-2 py-2"
              >
                <span className={MONO}>
                  {line.sku} × {formatNumber(line.quantity)}
                </span>
                {line.production && line.production.state !== "NOT_REQUIRED" && (
                  <span className="text-ink-secondary">
                    {PRODUCTION_STATE[line.production.state] ?? line.production.state} ·{" "}
                    {formatNumber(line.production.goodQuantity)} cái đạt
                  </span>
                )}
                <span className={MONO}>{formatMoney(line.lineTotal, order.currency)}</span>
              </li>
            ))}
          </ul>
          <p className="flex justify-between text-base font-semibold">
            <span>Tổng</span>
            <span className={MONO}>{formatMoney(order.total, order.currency)}</span>
          </p>
          {order.payment?.depositRequired != null && (
            <p className="text-ink-secondary text-sm">
              Cọc cần:{" "}
              <span className={MONO}>
                {formatMoney(order.payment.depositRequired, order.currency)}
              </span>
            </p>
          )}
        </section>
        <section
          aria-labelledby="order-timeline"
          className="bg-bg-surface border-border-default space-y-3 rounded-[var(--r-lg)] border p-6"
        >
          <h2 id="order-timeline" className="font-semibold">
            Tiến trình
          </h2>
          <ol className="border-border-default space-y-3 border-l pl-4 text-sm">
            {order.timeline.map((entry, index) => (
              <li key={`${entry.occurredAt}-${index}`}>
                <StatusDot domain="order" status={STATUS_GROUP_DISPLAY[entry.statusGroup]} />
                <div className="text-ink-tertiary tabular-nums">
                  {formatDateTime(entry.occurredAt)}
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
      {result && (
        <p role="status" className="text-ink-secondary text-sm">
          {result}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {order.statusGroup !== "CANCELLED" && (
          <Button
            variant="outline"
            className="min-h-11"
            disabled={reorder.isPending}
            onClick={() => setConfirm(true)}
          >
            <RotateCcw className="size-4" /> Đặt lại
          </Button>
        )}
        {/* SCRUM-257: BE chưa có API đổi trả (RMA) — hiện rõ là chưa khả dụng, không giả lập gửi. */}
        {order.statusGroup === "DELIVERED" && (
          <span className="inline-flex flex-col">
            <Button
              variant="outline"
              className="min-h-11"
              disabled
              aria-describedby="rma-unavailable"
            >
              Yêu cầu đổi trả
            </Button>
            <span id="rma-unavailable" className="text-ink-tertiary mt-1 text-xs">
              Chức năng đổi trả chưa mở — vui lòng liên hệ bộ phận bán hàng.
            </span>
          </span>
        )}
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Đặt lại đơn này?"
        description="Hệ thống gửi yêu cầu báo giá mới cho bộ phận bán hàng theo giá và điều khoản hiện hành; đơn chỉ được tạo sau khi bạn chấp nhận báo giá mới."
        confirmLabel="Gửi yêu cầu báo giá"
        variant="default"
        loading={reorder.isPending}
        closeOnConfirm={false}
        onConfirm={() =>
          reorder.mutate(
            { orderId: order.orderId, requestId },
            {
              onSuccess: () => {
                setConfirm(false);
                setResult(
                  "Đã gửi yêu cầu báo giá mới. Bạn sẽ thấy báo giá ở mục Báo giá khi Sales gửi.",
                );
              },
              onError: (error) => {
                setConfirm(false);
                setResult(myOrderErrorMessage(error));
              },
            },
          )
        }
      />
    </div>
  );
}
