"use client";

import Link from "next/link";
import { AlarmClock } from "lucide-react";

import {
  ADMIN_ROUTES,
  DELAY_ALERT_DESCRIPTIONS,
  DELAY_ALERT_LABELS,
  DELAY_ALERT_PERMISSIONS,
  PRODUCTION_LABELS,
  UI_LABELS,
} from "@/constants";
import { useCan } from "@/lib/auth";
import { formatDateTime } from "@/lib/format/date";
import { useOpenDelayAlerts } from "@/lib/references/delay-alerts";
import { Alert } from "@/components/shared/Alert";
import { ToneDot } from "@/components/shared/column-helpers";
import { DETAIL_CARD_CLASS, DetailCardTitle } from "@/components/shared/DetailSection";
import { Button } from "@/components/ui/button";

import { DELAY_ALERT_TONE } from "./DelayFlags";

import type { DelayAlert } from "@/lib/references/delay-alerts";

const L = PRODUCTION_LABELS.alerts;

/** Cờ trễ thật (danger) lên trước nguy cơ (warning), cùng tone thì mở sớm trước. */
const ordered = (alerts: readonly DelayAlert[]) =>
  [...alerts].sort(
    (a, b) =>
      Number(DELAY_ALERT_TONE[a.type] !== "danger") -
        Number(DELAY_ALERT_TONE[b.type] !== "danger") || a.openedAt.localeCompare(b.openedAt),
  );

function Subject({ alert }: { alert: DelayAlert }) {
  if (alert.productionOrderId && alert.productionOrderCode)
    return (
      <Link
        href={ADMIN_ROUTES.productionOrders.detail(alert.productionOrderId)}
        className="text-accent font-[family-name:var(--font-mono)] hover:underline"
      >
        {L.productionOrder(alert.productionOrderCode)}
      </Link>
    );
  if (alert.deliveryBatchSeq) return <span>{L.batch(alert.deliveryBatchSeq)}</span>;
  return null;
}

/**
 * Cờ trễ của đơn trên trang nội bộ (docs 17 §4.12 bước 49): cảnh báo đang mở, chủ thể (Đơn sản xuất / đợt giao), lúc mở.
 * Không chặn thao tác, khách không thấy. `productionOrderId` có → chỉ cờ của Đơn sản xuất đó. Không quyền / không cờ →
 * không chiếm chỗ; lỗi tải → một dòng báo + Thử lại (cờ là thông tin phụ, lỗi không làm hỏng trang đơn).
 */
export function DelayAlertsPanel({
  salesOrderId,
  productionOrderId,
}: {
  salesOrderId: string;
  productionOrderId?: string;
}) {
  // UI-only — Backend phải re-check (`@RequiresPermission` delay-alerts:READ, BE lọc theo kho của người xem)
  const canRead = useCan(DELAY_ALERT_PERMISSIONS.read);
  const query = useOpenDelayAlerts(salesOrderId, canRead);
  const alerts = ordered(
    (query.data ?? []).filter(
      (a) => !productionOrderId || a.productionOrderId === productionOrderId,
    ),
  );
  if (!canRead) return null;
  if (query.isError)
    return (
      <Alert tone="warning">
        {L.loadFailed}{" "}
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0"
          onClick={() => void query.refetch()}
        >
          {UI_LABELS.common.retry}
        </Button>
      </Alert>
    );
  if (alerts.length === 0) return null;
  return (
    <section className={DETAIL_CARD_CLASS} aria-label={L.orderTitle}>
      <DetailCardTitle icon={AlarmClock}>{L.orderTitle}</DetailCardTitle>
      <ul className="divide-y divide-(--table-line)">
        {alerts.map((alert) => (
          <li key={alert.id} className="py-2 text-[0.8125rem]">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <ToneDot tone={DELAY_ALERT_TONE[alert.type]} label={DELAY_ALERT_LABELS[alert.type]} />
              <Subject alert={alert} />
              <span className="text-ink-tertiary ml-auto text-xs tabular-nums">
                {L.since(formatDateTime(alert.openedAt))}
              </span>
            </div>
            <p className="text-ink-secondary mt-0.5 text-xs">
              {DELAY_ALERT_DESCRIPTIONS[alert.type]}
            </p>
          </li>
        ))}
      </ul>
      <p className="text-ink-tertiary mt-2 text-xs">{L.orderDescription}</p>
    </section>
  );
}
