"use client";

import { StatusDot } from "@/components/shared/StatusDot";

import { cardKindLabel, cardStateView } from "../card-view";

import { DocumentCardBody } from "./DocumentCardBody";
import { QuoteRequestCardBody } from "./QuoteRequestCardBody";

import type { ChatMessage } from "../schemas";
import type { QuoteGate } from "./QuoteRequestCardBody";

export type { QuoteGate } from "./QuoteRequestCardBody";

/**
 * Thẻ trong hội thoại (render theo `card.kind` + `payload` + `state`). Trạng thái thẻ là chấm trạng thái có chữ
 * (BO-UX-48), tên loại / trạng thái lạ thành nhãn trung tính, không hiện mã BE (BO-UX-6). Sale không có nút thay khách.
 */
export function ChatCardView({
  message,
  quoteGate,
}: {
  message: ChatMessage;
  quoteGate: QuoteGate;
}) {
  const card = message.card;
  if (!card) return null;
  const state = cardStateView(card);
  return (
    <div className="border-border-default bg-bg-surface space-y-1 rounded-[var(--r-sm)] border p-3 text-[0.8125rem]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-ink-primary font-semibold">{cardKindLabel(card.kind)}</span>
        <StatusDot domain="order" status={state.toneKey} label={state.label} />
      </div>
      {card.kind === "QUOTE_REQUEST" ? (
        <QuoteRequestCardBody message={message} card={card} quoteGate={quoteGate} />
      ) : (
        <DocumentCardBody card={card} />
      )}
    </div>
  );
}
