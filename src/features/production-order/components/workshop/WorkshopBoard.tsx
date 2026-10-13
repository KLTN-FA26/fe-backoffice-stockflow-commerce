"use client";

import Link from "next/link";

import { ADMIN_ROUTES } from "@/constants";
import { formatDate } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";
import { useProductionOrders } from "@/features/production-order/queries";
import {
  HOLD_REASON_LABEL,
  isOverdue,
  productionStatusLabel,
  todayVn,
} from "@/features/production-order/selectors";
import { Skeleton } from "@/components/shared/Skeleton";
import { StatusDot } from "@/components/shared/StatusDot";

import { MONO } from "../copy";

import type { ProductionApiStatus } from "@/constants";

/** Cột bảng xưởng — theo trạng thái LSX (SCRUM-417); thao tác chi tiết nằm ở màn LSX. */
const COLUMNS: readonly ProductionApiStatus[] = [
  "PENDING_PREPRESS",
  "READY",
  "MATERIAL_ISSUED",
  "PRINTING",
  "QC",
  "SUBCONTRACTED",
  "ON_HOLD",
];
const COLUMN_LIMIT = 30;

function Column({ status, today }: { status: ProductionApiStatus; today: string }) {
  // Hàng đợi theo hạn giao sớm trước (BR-PRD-07).
  const query = useProductionOrders({
    status: [status],
    size: COLUMN_LIMIT,
    sort: "dueDate,asc;createdAt,asc",
  });
  const items = query.data?.items ?? [];
  const total = query.data?.totalElements ?? 0;
  return (
    <section
      aria-labelledby={`col-${status}`}
      className="bg-bg-subtle border-border-default flex w-64 shrink-0 flex-col rounded-[var(--r-sm)] border"
    >
      <header className="border-border-default flex items-center justify-between border-b px-3 py-2">
        <h2 id={`col-${status}`} className="text-ink-primary text-[0.8125rem] font-semibold">
          {productionStatusLabel(status)}
        </h2>
        <Link
          href={`${ADMIN_ROUTES.productionOrders.list}?status=${status}`}
          className={`text-ink-tertiary hover:underline ${MONO}`}
          aria-label={`Xem tất cả ${total} LSX ${productionStatusLabel(status)}`}
        >
          {total}
        </Link>
      </header>
      <ul className="flex max-h-[560px] flex-col gap-2 overflow-y-auto p-2">
        {query.isPending && (
          <li aria-hidden="true">
            <Skeleton className="h-20" />
          </li>
        )}
        {query.isError && (
          <li role="alert" className="text-danger text-xs">
            Không tải được cột này.{" "}
            <button type="button" className="underline" onClick={() => void query.refetch()}>
              Thử lại
            </button>
          </li>
        )}
        {!query.isPending && items.length === 0 && (
          <li className="text-ink-tertiary text-xs">Trống</li>
        )}
        {items.map((row) => (
          <li key={row.id}>
            <Link
              href={ADMIN_ROUTES.productionOrders.detail(row.id)}
              className="bg-bg-surface border-border-default hover:border-border-strong focus-visible:ring-brand block space-y-1 rounded-[var(--r-sm)] border p-2 text-xs focus-visible:ring-2 focus-visible:outline-none"
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`text-ink-primary font-medium ${MONO}`}>{row.orderNumber}</span>
                <span className="text-ink-tertiary">{row.type === "SAMPLE" ? "Mẫu" : "Đơn"}</span>
              </div>
              <div className={`text-ink-secondary ${MONO}`}>
                {row.blankSku} · {formatNumber(row.goodQuantity)}/
                {formatNumber(row.plannedQuantity)}
              </div>
              <div className="flex flex-wrap gap-x-2">
                {row.dueDate && (
                  <span
                    className={
                      isOverdue(row, today) ? "text-danger font-medium" : "text-ink-tertiary"
                    }
                  >
                    Hạn {formatDate(row.dueDate)}
                  </span>
                )}
                {row.mode === "SUBCONTRACTED" && (
                  <StatusDot domain="order" status="Subcontracted" />
                )}
                {row.holdReason && (
                  <span className="text-ink-secondary">{HOLD_REASON_LABEL[row.holdReason]}</span>
                )}
              </div>
            </Link>
          </li>
        ))}
        {total > items.length && (
          <li className="text-ink-tertiary text-xs">
            +{total - items.length} LSX khác — xem danh sách
          </li>
        )}
      </ul>
    </section>
  );
}

export function WorkshopBoard() {
  const today = todayVn();
  return (
    <div
      className="flex gap-3 overflow-x-auto pb-2"
      role="region"
      aria-label="Bảng xưởng theo trạng thái"
    >
      {COLUMNS.map((status) => (
        <Column key={status} status={status} today={today} />
      ))}
    </div>
  );
}
