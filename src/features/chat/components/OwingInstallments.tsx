"use client";

import { CHAT_INBOX_LABELS } from "@/constants/labels-chat";
import { formatDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";

import { owedOf } from "../lifecycle";

import type { ChatCustomerOverview } from "../schemas";

/**
 * Đợt còn phải thu ở panel khách (S18): số hợp đồng + đợt và hạn bên trái (xuống dòng được), số tiền còn phải thu trọn
 * một dòng ở mép phải — không bị cắt ở mép thẻ (UI/UX bo-33). Đợt quá hạn chữ đỏ, ghi rõ "quá hạn" bằng chữ.
 */
export function OwingInstallments({
  installments,
}: {
  installments: ChatCustomerOverview["installments"];
}) {
  return (
    <ul className="space-y-1.5">
      {installments.map((item) => (
        <li
          key={item.id}
          className={`flex items-baseline justify-between gap-3 ${item.overdue ? "text-danger" : ""}`}
        >
          <div className="min-w-0">
            <div className="break-all">
              {item.contractNumber ?? item.orderNumber} — {CHAT_INBOX_LABELS.installment(item.seq)}
            </div>
            {(item.dueDate || item.overdue) && (
              <div className={`text-xs ${item.overdue ? "" : "text-ink-tertiary"}`}>
                {item.dueDate && CHAT_INBOX_LABELS.dueOn(formatDate(item.dueDate))}
                {item.dueDate && item.overdue && " · "}
                {item.overdue && CHAT_INBOX_LABELS.overdue.toLowerCase()}
              </div>
            )}
          </div>
          <span className="shrink-0 font-medium whitespace-nowrap tabular-nums">
            {formatMoney(owedOf(item), item.currency)}
          </span>
        </li>
      ))}
    </ul>
  );
}
