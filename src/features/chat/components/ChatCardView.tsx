"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FilePlus2, LoaderCircle } from "lucide-react";

import { ADMIN_ROUTES, CHAT_CARD_LABELS, CHAT_CARD_STATE_LABELS } from "@/constants";
import { formatDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import { useChatFailure, useStaffCardAction } from "../mutations";
import {
  DESIGN_STATUS_LABELS,
  designWaitNote,
  payloadNumber,
  payloadText,
  quoteRequestView,
} from "../selectors";

import type { ChatCard, ChatMessage } from "../schemas";

/** Ai lập được báo giá từ thẻ ở hội thoại này (người phụ trách / giám sát) và câu giải thích khi không. */
export interface QuoteGate {
  allowed: boolean;
  hint: string | null;
}

function QuoteRequestBody({
  message,
  card,
  quoteGate,
}: {
  message: ChatMessage;
  card: ChatCard;
  quoteGate: QuoteGate;
}) {
  const view = quoteRequestView(card);
  const failure = useChatFailure();
  const waitNote = designWaitNote(view);
  const router = useRouter();
  const action = useStaffCardAction();
  // Nút vẽ đúng `card.staffActions` của BE (CardActions.quotable): chỉ khi thiết kế đã duyệt và chưa có báo giá.
  const canCreate = card.staffActions.includes("CREATE_QUOTE");
  return (
    <div className="space-y-1">
      <div className="font-medium">{view.title ?? "Thiết kế"}</div>
      {view.scope === "DESIGN" ? (
        <div className="text-ink-secondary">
          {view.cartons != null && `${view.cartons} thùng`}
          {view.desiredDeliveryDate && ` · giao mong muốn ${formatDate(view.desiredDeliveryDate)}`}
          {view.designStatus &&
            ` · ${DESIGN_STATUS_LABELS[view.designStatus] ?? view.designStatus}`}
        </div>
      ) : (
        <ul className="text-ink-secondary">
          {view.lines.map((line, i) => (
            <li key={i}>
              {line.designName} — {line.cartons} thùng (
              {DESIGN_STATUS_LABELS[line.designStatus ?? ""] ?? line.designStatus})
            </li>
          ))}
        </ul>
      )}
      {view.returnReason && <div className="text-warning">Lý do trả lại: {view.returnReason}</div>}
      {view.quoteId && (
        <Link
          href={ADMIN_ROUTES.quotes.detail(view.quoteId)}
          className="text-accent hover:underline"
        >
          Báo giá {view.quoteNumber ?? ""}
        </Link>
      )}
      {!canCreate && !view.quoteId && card.state === "OPEN" && waitNote && (
        <div className="text-ink-tertiary">{waitNote}</div>
      )}
      {canCreate && (
        <Button
          size="sm"
          disabled={action.isPending || !quoteGate.allowed}
          onClick={() =>
            action.mutate(
              { id: message.conversationId, messageId: message.id, action: "CREATE_QUOTE" },
              {
                onSuccess: (acted) => {
                  const quoteId = acted.card ? payloadText(acted.card, "quoteId") : null;
                  if (quoteId) router.push(ADMIN_ROUTES.quotes.detail(quoteId));
                },
                onError: (error) => toast.error(failure(error)),
              },
            )
          }
        >
          {action.isPending ? (
            <LoaderCircle className="size-3.5 animate-spin" />
          ) : (
            <FilePlus2 className="size-3.5" />
          )}{" "}
          Lập báo giá
        </Button>
      )}
      {canCreate && !quoteGate.allowed && quoteGate.hint && (
        <div className="text-ink-tertiary">{quoteGate.hint}</div>
      )}
    </div>
  );
}

function DocumentBody({ card }: { card: ChatCard }) {
  const currency = payloadText(card, "currency") ?? "VND";
  const number = payloadText(card, "number") ?? payloadText(card, "contractNumber");
  const amount =
    payloadNumber(card, "proposedTotal") ??
    payloadNumber(card, "totalAmount") ??
    payloadNumber(card, "amount");
  const quoteId = payloadText(card, "quoteId");
  const orderId = payloadText(card, "orderId");
  return (
    <div className="space-y-1">
      {number && <div className="font-[family-name:var(--font-mono)]">{number}</div>}
      {amount != null && <div className="tabular-nums">{formatMoney(amount, currency)}</div>}
      {payloadText(card, "transferContent") && (
        <div>Nội dung CK: {payloadText(card, "transferContent")}</div>
      )}
      {card.kind === "QUOTE" && quoteId && (
        <Link href={ADMIN_ROUTES.quotes.detail(quoteId)} className="text-accent hover:underline">
          Mở báo giá
        </Link>
      )}
      {card.kind !== "QUOTE" && orderId && (
        <Link href={ADMIN_ROUTES.orders.contract(orderId)} className="text-accent hover:underline">
          Mở đơn
        </Link>
      )}
    </div>
  );
}

/** Thẻ trong hội thoại (render theo `card.kind` + `payload` + `state`). Sale không có nút thay khách. */
export function ChatCardView({
  message,
  quoteGate,
}: {
  message: ChatMessage;
  quoteGate: QuoteGate;
}) {
  const card = message.card;
  if (!card) return null;
  return (
    <div className="border-border-default bg-bg-surface space-y-1 rounded-[var(--r-sm)] border p-3 text-[0.8125rem]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-ink-primary font-semibold">
          {CHAT_CARD_LABELS[card.kind] ?? card.kind}
        </span>
        <span className="text-ink-tertiary text-xs">
          {CHAT_CARD_STATE_LABELS[card.state] ?? card.state}
        </span>
      </div>
      {card.kind === "QUOTE_REQUEST" ? (
        <QuoteRequestBody message={message} card={card} quoteGate={quoteGate} />
      ) : (
        <DocumentBody card={card} />
      )}
    </div>
  );
}
