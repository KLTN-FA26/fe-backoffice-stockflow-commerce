"use client";

import { ArrowRight, History } from "lucide-react";

import { formatDateTime } from "@/lib/format/date";
import { Skeleton } from "@/components/shared/Skeleton";
import { StatusDot } from "@/components/shared/StatusDot";

import { useOrderHistory } from "../queries";

import { OrderLoadError } from "./OrderLoadError";

interface OrderStatusHistoryProps {
  orderId: string;
}

/**
 * Lịch sử trạng thái — `GET /orders/{id}/history` (BE OrderStatusChangeResponse), mới nhất ở
 * trên để Coordinator thấy bước gần nhất trước. docs 17 BR-01: trạng thái hợp nhất, không nhảy cóc.
 */
export function OrderStatusHistory({ orderId }: OrderStatusHistoryProps) {
  const query = useOrderHistory(orderId);

  return (
    <section
      aria-labelledby="order-history-title"
      className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]"
    >
      <h2
        id="order-history-title"
        className="text-ink-primary mb-3 flex items-center gap-2 text-[0.9375rem] font-semibold"
      >
        <History className="text-accent size-4" aria-hidden="true" />
        Lịch sử trạng thái
      </h2>
      {query.isPending ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-5 w-3/5" />
        </div>
      ) : query.isError ? (
        <OrderLoadError inline error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.length === 0 ? (
        <p className="text-ink-tertiary text-xs">Chưa có bước chuyển trạng thái nào.</p>
      ) : (
        <ol className="border-border-default space-y-3 border-l pl-4">
          {[...query.data].reverse().map((change, index) => (
            <li key={`${change.occurredAt}-${index}`} className="relative">
              <span
                aria-hidden="true"
                className="bg-border-strong absolute top-1.5 -left-[1.3rem] size-2 rounded-full"
              />
              <div className="flex flex-wrap items-center gap-1.5 text-[0.8125rem]">
                {change.from ? (
                  <>
                    <StatusDot domain="order" status={change.from} />
                    <ArrowRight className="text-ink-tertiary size-3" aria-label="sang" />
                  </>
                ) : (
                  <span className="text-ink-tertiary text-xs">Tạo đơn ·</span>
                )}
                <StatusDot domain="order" status={change.to} />
              </div>
              <div className="text-ink-tertiary mt-0.5 text-xs tabular-nums">
                {formatDateTime(change.occurredAt)}
              </div>
              {change.reason && (
                <p className="text-ink-secondary mt-0.5 max-w-[68ch] text-xs">{change.reason}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
