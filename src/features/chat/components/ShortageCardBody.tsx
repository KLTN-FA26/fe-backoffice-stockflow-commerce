"use client";

import {
  ADMIN_ROUTES,
  ORDER_PERMISSIONS,
  SHORTAGE_ENDED_LABELS,
  SHORTAGE_LABELS,
  SHORTAGE_OPTION_LABELS,
} from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import {
  shortageCardName,
  shortageCardSchema,
  shortageOptionEffects,
} from "@/lib/domain/shortage-card";
import { PermittedLink } from "@/components/backoffice/PermittedLink";

import type { ChatCard } from "../schemas";

const L = SHORTAGE_LABELS;

/** Hình thẻ từ `card.payload` (BE `ShortageCardMessages.payload` = hình của trang đơn); `null` nếu payload hỏng. */
export function parseShortagePayload(card: Pick<ChatCard, "payload">) {
  const parsed = shortageCardSchema.safeParse(card.payload);
  return parsed.success ? parsed.data : null;
}

/**
 * Thẻ "Đơn thiếu N thùng" trong chat, phía Sale (docs 16 §4.7, BR-15; 17 §4.14): chỉ xem — các thùng thiếu theo SKU, bốn
 * hướng kèm hệ quả, khách đã chọn gì. Sale KHÔNG chọn thay khách; việc "Thực hiện" nằm ở trang đơn (nút dẫn tới mục
 * `#shortage`). Link chỉ hiện khi mở được trang đơn (VIEW_PAGE, AUTH-8).
 */
export function ShortageCardBody({ card }: { card: ChatCard }) {
  const data = parseShortagePayload(card);
  if (!data) return null;
  const chosen = data.chosen?.option;
  const needsExecution =
    data.status === "ANSWERED" || (data.status !== "EXECUTED" && data.executionStarted);
  return (
    <div className="space-y-2">
      <div className="text-ink-secondary font-[family-name:var(--font-mono)] text-xs">
        {shortageCardName(data)} · {data.orderNumber}
      </div>
      <ul className="space-y-0.5">
        {data.lines.map((line) => (
          <li key={line.sku} className="flex justify-between gap-3">
            <span className="min-w-0 truncate">{line.skuName ?? line.sku}</span>
            <span className="text-danger shrink-0 tabular-nums">
              {L.tableMissing} {line.missingCartons}/{line.batchCartons} {L.tableUnit}
            </span>
          </li>
        ))}
      </ul>
      <ul className="space-y-1">
        {data.options.map((option) => (
          <li
            key={option.option}
            className={`rounded-[var(--r-sm)] border px-2 py-1 ${
              chosen === option.option ? "border-accent bg-accent/5" : "border-border-default"
            }`}
          >
            <span className="font-medium">{SHORTAGE_OPTION_LABELS[option.option]}</span>
            {shortageOptionEffects(option, data).map((line) => (
              <span key={line} className="text-ink-secondary block text-xs">
                {line}
              </span>
            ))}
          </li>
        ))}
      </ul>
      {data.chosen && (
        <p className="text-ink-primary">
          {L.chosen(SHORTAGE_OPTION_LABELS[data.chosen.option], formatDateTime(data.chosen.at))}
        </p>
      )}
      {data.endedReason && (
        <p className="text-ink-secondary">{SHORTAGE_ENDED_LABELS[data.endedReason]}</p>
      )}
      <PermittedLink
        permission={ORDER_PERMISSIONS.viewPage}
        href={ADMIN_ROUTES.orders.shortage(data.orderId)}
        className="text-accent-text hover:underline"
        fallback={null}
      >
        {needsExecution ? L.openInOrder : L.chat.openOrder}
      </PermittedLink>
    </div>
  );
}
