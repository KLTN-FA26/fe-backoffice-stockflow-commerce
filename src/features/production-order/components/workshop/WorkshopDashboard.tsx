"use client";

import Link from "next/link";
import { parseAsString, useQueryState } from "nuqs";
import { AlertTriangle, Clock, FlaskConical, Printer, Trash2 } from "lucide-react";

import { ADMIN_ROUTES, SAMPLE_REQUEST_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth/components/Can";
import { formatDate } from "@/lib/format/date";
import { formatNumber, formatPercent } from "@/lib/format/number";
import { useOverdueProduction, useProductionDashboard } from "@/features/production-order/queries";
import { productionStatusLabel } from "@/features/production-order/selectors";
import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { Card } from "@/components/shared/Card";
import { FORM_INPUT_CLASS } from "@/components/shared/FormField";
import { Skeleton } from "@/components/shared/Skeleton";
import { StatTile } from "@/components/shared/StatTile";
import { Input } from "@/components/ui/input";

import { MONO, PRODUCTION_COPY } from "../copy";

/**
 * Dashboard xưởng (SCRUM-416). QA3 (2026-10-13): kỳ đếm theo HOẠT ĐỘNG thực tế — số cái in / phế
 * trong kỳ, kể cả LSX tạo trước kỳ (basis=ACTIVITY mặc định của BE). Số liệu 100% từ BE.
 */
export function WorkshopDashboard() {
  const [from, setFrom] = useQueryState("from", parseAsString.withDefault(""));
  const [to, setTo] = useQueryState("to", parseAsString.withDefault(""));
  const dashboard = useProductionDashboard({
    from: from || undefined,
    to: to || undefined,
    basis: "ACTIVITY",
  });
  const overdue = useOverdueProduction();
  const canSeeSamples = useCan(SAMPLE_REQUEST_PERMISSIONS.read);
  const data = dashboard.data;
  const open = data ? Object.values(data.openByStatus).reduce((sum, count) => sum + count, 0) : 0;

  return (
    <div className="space-y-4">
      <div className="bg-bg-subtle border-border-default flex flex-wrap items-end gap-3 rounded-[var(--r-sm)] border px-3 py-2 text-[0.8125rem]">
        <label className="flex items-center gap-2">
          Từ{" "}
          <Input
            type="date"
            value={from}
            onChange={(e) => void setFrom(e.target.value || null)}
            className={`${FORM_INPUT_CLASS} w-40`}
          />
        </label>
        <label className="flex items-center gap-2">
          đến{" "}
          <Input
            type="date"
            value={to}
            onChange={(e) => void setTo(e.target.value || null)}
            className={`${FORM_INPUT_CLASS} w-40`}
          />
        </label>
        <span className="text-ink-tertiary">
          Tính theo số cái in / phế thực tế trong kỳ
          {data?.periodFrom
            ? ` (${formatDate(data.periodFrom)} → ${data.periodTo ? formatDate(data.periodTo) : "nay"})`
            : ""}
          .
        </span>
      </div>
      {dashboard.isError ? (
        <LoadErrorState
          inline
          error={dashboard.error}
          copy={PRODUCTION_COPY}
          onRetry={() => void dashboard.refetch()}
        />
      ) : !data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatTile label="LSX đang mở" value={formatNumber(open)} icon={Clock} />
          <StatTile label="Quá hạn" value={formatNumber(data.overdue)} icon={AlertTriangle} />
          <StatTile
            label="Đã in trong kỳ (cái)"
            value={formatNumber(data.printed)}
            icon={Printer}
          />
          <StatTile
            label="Phế trong kỳ (cái)"
            value={formatNumber(data.scrap)}
            icon={Trash2}
            subtitle={
              data.scrapRate != null
                ? `Tỷ lệ phế ${formatPercent(data.scrapRate * 100, 2)}`
                : "Chưa in trong kỳ"
            }
          />
          <StatTile
            label="Mẫu chờ khách duyệt"
            value={formatNumber(data.samplesAwaitingApproval)}
            icon={FlaskConical}
          />
        </div>
      )}
      {data && (
        <Card className="space-y-2">
          <h2 className="text-ink-primary text-sm font-semibold">LSX đang mở theo trạng thái</h2>
          <ul className="flex flex-wrap gap-2 text-[0.8125rem]">
            {Object.entries(data.openByStatus).map(([status, count]) => (
              <li key={status}>
                <Link
                  href={`${ADMIN_ROUTES.productionOrders.list}?status=${status}`}
                  className="border-border-default hover:bg-bg-muted inline-flex items-center gap-2 rounded-[var(--r-sm)] border px-2 py-1"
                >
                  {productionStatusLabel(status)}{" "}
                  <span className={MONO}>{formatNumber(count)}</span>
                </Link>
              </li>
            ))}
          </ul>
          {canSeeSamples && data.samplesAwaitingApproval > 0 && (
            <Link
              href={`${ADMIN_ROUTES.sampleRequests.list}?status=SENT_TO_CUSTOMER`}
              className="text-accent text-[0.8125rem] hover:underline"
            >
              Xem mẫu chờ khách duyệt
            </Link>
          )}
        </Card>
      )}
      <Card className="space-y-2">
        <h2 className="text-ink-primary text-sm font-semibold">Quá hạn giao</h2>
        {overdue.isPending && <p className="text-ink-tertiary text-[0.8125rem]">Đang tải…</p>}
        {overdue.isError && (
          <p role="alert" className="text-danger text-[0.8125rem]">
            Không tải được danh sách quá hạn.
          </p>
        )}
        {overdue.data?.items.length === 0 && (
          <p className="text-ink-tertiary text-[0.8125rem]">Không có LSX quá hạn.</p>
        )}
        <ul className="space-y-1 text-[0.8125rem]">
          {overdue.data?.items.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-3">
              <Link
                href={ADMIN_ROUTES.productionOrders.detail(row.id)}
                className={`text-accent hover:underline ${MONO}`}
              >
                {row.orderNumber}
              </Link>
              <span className="text-danger tabular-nums">
                hạn {row.dueDate ? formatDate(row.dueDate) : "—"}
              </span>
              <span className="text-ink-secondary">{productionStatusLabel(row.status)}</span>
              {/* SCRUM-442: cảnh báo nhà gia công trễ hạn trên dashboard xưởng */}
              {row.mode === "SUBCONTRACTED" && (
                <span className="text-warning font-medium">Nhà gia công trễ hạn</span>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
