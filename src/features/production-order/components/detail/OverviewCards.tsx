"use client";

import Link from "next/link";

import { ADMIN_ROUTES, ORDER_PERMISSIONS, SAMPLE_REQUEST_PERMISSIONS } from "@/constants";

import { usePermissionChecker } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";

import { useScrap } from "@/features/production-order/queries";
import {
  SCRAP_REASON_LABEL,
  isOverdue,
  productionStatusLabel,
  todayVn,
} from "@/features/production-order/selectors";

import { Card } from "@/components/shared/Card";

import { MONO, ProductionStatus, TYPE_LABEL } from "../copy";

import type { ProductionDetail } from "@/features/production-order/types";

export const ORIGIN = {
  SPLIT: "LSX con gia công (tách từ)",
  SHORTFALL: "LSX bù tại xưởng (từ gia công)",
  REPLACEMENT: "LSX thay thế gia công (từ)",
} as const;

export function Overview({ order }: { order: ProductionDetail }) {
  const can = usePermissionChecker();
  const s = order.summary;
  const rows: [string, React.ReactNode][] = [
    [
      "Loại",
      `${TYPE_LABEL[s.type]}${s.mode === "SUBCONTRACTED" ? " · gia công ngoài" : " · tại xưởng"}`,
    ],
    [
      "Phôi",
      <span key="sku" className={MONO}>
        {s.blankSku}
      </span>,
    ],
    [
      "Kế hoạch",
      <span key="p" className={MONO}>
        {formatNumber(s.plannedQuantity)} cái
      </span>,
    ],
    [
      "Đã xuất / in / đạt / phế",
      <span key="q" className={MONO}>
        {formatNumber(order.issuedQuantity)} / {formatNumber(order.printedQuantity)} /{" "}
        {formatNumber(s.goodQuantity)} / {formatNumber(order.scrapQuantity)}
      </span>,
    ],
    [
      "Hạn giao",
      <span key="d" className={isOverdue(s, todayVn()) ? "text-danger font-medium" : undefined}>
        {s.dueDate ? formatDate(s.dueDate) : "—"}
      </span>,
    ],
  ];
  if (s.sampleRequestId)
    rows.push([
      "Yêu cầu mẫu",
      can(SAMPLE_REQUEST_PERMISSIONS.read) ? (
        <Link
          key="sr"
          href={ADMIN_ROUTES.sampleRequests.detail(s.sampleRequestId)}
          className="text-accent hover:underline"
        >
          Mở yêu cầu mẫu
        </Link>
      ) : (
        "—"
      ),
    ]);
  if (s.salesOrderId)
    rows.push([
      "Đơn bán",
      can(ORDER_PERMISSIONS.read) ? (
        <Link
          key="so"
          href={ADMIN_ROUTES.orders.detail(s.salesOrderId)}
          className="text-accent hover:underline"
        >
          Mở đơn bán
        </Link>
      ) : (
        <span className={MONO}>{s.salesOrderId.slice(0, 8)}</span>
      ),
    ]);
  if (s.parentId)
    rows.push([
      order.origin ? ORIGIN[order.origin] : "LSX cha",
      <Link
        key="pa"
        href={ADMIN_ROUTES.productionOrders.detail(s.parentId)}
        className="text-accent hover:underline"
      >
        Mở LSX liên quan
      </Link>,
    ]);
  if (s.salesOrderId)
    rows.push([
      "LSX cùng đơn",
      <Link
        key="sib"
        href={ADMIN_ROUTES.productionOrders.bySalesOrder(s.salesOrderId)}
        className="text-accent hover:underline"
      >
        Xem LSX cha / con
      </Link>,
    ]);
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-ink-primary text-sm font-semibold">Tổng quan</h2>
        <ProductionStatus row={s} />
      </div>
      <dl className="grid grid-cols-[minmax(150px,auto)_1fr] gap-x-4 gap-y-2 text-[0.8125rem]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-ink-tertiary">{label}</dt>
            <dd className="min-w-0 break-words">{value}</dd>
          </div>
        ))}
      </dl>
      {order.cancellationReason && (
        <p className="text-ink-secondary text-[0.8125rem]">
          Lý do huỷ / dừng: {order.cancellationReason}
        </p>
      )}
    </Card>
  );
}

export function HistoryAndScrap({ order }: { order: ProductionDetail }) {
  const scrap = useScrap(order.summary.id);
  return (
    <Card className="space-y-3">
      <h2 className="text-ink-primary text-sm font-semibold">Lịch sử</h2>
      <ol className="border-border-default space-y-2 border-l pl-4 text-[0.8125rem]">
        {order.history.map((change, index) => (
          <li key={`${change.changedAt}-${index}`}>
            <div className="font-medium">
              {change.fromStatus ? `${productionStatusLabel(change.fromStatus)} → ` : "Tạo → "}
              {productionStatusLabel(change.toStatus)}
            </div>
            <div className="text-ink-tertiary tabular-nums">
              {formatDateTime(change.changedAt)}
              {change.changedBy ? "" : " · hệ thống"}
            </div>
            {change.reason && <div className="text-ink-secondary">{change.reason}</div>}
          </li>
        ))}
      </ol>
      {!!scrap.data?.length && (
        <>
          <h3 className="text-ink-primary text-[0.8125rem] font-semibold">Phế phẩm</h3>
          <ul className={`space-y-0.5 ${MONO}`}>
            {scrap.data.map((row) => (
              <li key={row.id}>
                {formatDateTime(row.recordedAt)} · {SCRAP_REASON_LABEL[row.reason]} ×{" "}
                {formatNumber(row.quantity)}
                {row.note ? ` — ${row.note}` : ""}
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
