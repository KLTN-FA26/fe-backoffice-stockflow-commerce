"use client";

import { DELAY_ALERT_DESCRIPTIONS, DELAY_ALERT_LABELS, PRODUCTION_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { EmptyCell, ToneDot } from "@/components/shared/column-helpers";

import type { DelayAlertType } from "@/constants";

/**
 * Tone của cờ trễ (docs 17 §4.12 bước 48): đã trễ (sản xuất trễ, đợt giao trễ) = danger; nguy cơ / cần lập Đơn sản
 * xuất = warning. Cờ chỉ báo, không chặn thao tác nào (bước 49).
 */
export const DELAY_ALERT_TONE = {
  PRODUCTION_LATE: "danger",
  DELIVERY_LATE: "danger",
  AT_RISK: "warning",
  PO_NEEDED: "warning",
} as const satisfies Record<DelayAlertType, "danger" | "warning">;

export interface DelayFlagView {
  type: DelayAlertType;
  openedAt: string;
}

/**
 * Cờ trễ đang mở của một dòng (lịch sản xuất, trang đơn). Mỗi cờ một chấm màu + tên; tooltip là điều kiện của cờ và
 * lúc mở. Không có cờ → ô trống (`emptyLabel` để hiện chữ thay vì "—").
 */
export function DelayFlags({
  flags,
  emptyLabel,
}: {
  flags: readonly DelayFlagView[];
  emptyLabel?: string;
}) {
  if (flags.length === 0)
    return emptyLabel ? (
      <span className="text-ink-tertiary text-xs">{emptyLabel}</span>
    ) : (
      <EmptyCell />
    );
  return (
    <ul className="flex flex-col gap-1" aria-label={PRODUCTION_LABELS.alerts.flagsTitle}>
      {flags.map((flag) => (
        <li
          key={`${flag.type}-${flag.openedAt}`}
          title={`${DELAY_ALERT_DESCRIPTIONS[flag.type]} (${PRODUCTION_LABELS.alerts.since(formatDateTime(flag.openedAt))})`}
        >
          <ToneDot tone={DELAY_ALERT_TONE[flag.type]} label={DELAY_ALERT_LABELS[flag.type]} />
        </li>
      ))}
    </ul>
  );
}
