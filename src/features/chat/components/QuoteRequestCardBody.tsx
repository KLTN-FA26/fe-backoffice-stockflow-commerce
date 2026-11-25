"use client";

import { useRouter } from "next/navigation";
import { FilePlus2, LoaderCircle } from "lucide-react";

import { ADMIN_ROUTES, CHAT_UNKNOWN_LABELS, QUOTE_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth/components/Can";
import { formatDate } from "@/lib/format/date";
import { PermittedLink } from "@/components/backoffice/PermittedLink";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import { useChatFailure, useStaffCardAction } from "../mutations";
import { DESIGN_STATUS_LABELS, designWaitNote, payloadText, quoteRequestView } from "../selectors";

import type { ChatCard, ChatMessage } from "../schemas";

/** Ai lập được báo giá từ thẻ ở hội thoại này (người phụ trách / giám sát) và câu giải thích khi không. */
export interface QuoteGate {
  allowed: boolean;
  hint: string | null;
}

/** BO-UX-6: trạng thái thiết kế bằng chữ, không bao giờ là mã BE. */
const designStatusLabel = (status: string | null) =>
  status ? (DESIGN_STATUS_LABELS[status] ?? CHAT_UNKNOWN_LABELS.designStatus) : null;

/** Thẻ yêu cầu báo giá: thiết kế, số thùng, ngày giao mong muốn; "Lập báo giá" theo `card.staffActions`. */
export function QuoteRequestCardBody({
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
  const offered = card.staffActions.includes("CREATE_QUOTE");
  // AUTH-2: lập báo giá từ thẻ là tạo báo giá — thiếu `sales-quotes:CREATE` thì không hiện nút.
  // UI-only, Backend phải re-check (QuoteFromRequestService.draw đòi quyền này).
  const mayCreateQuote = useCan(QUOTE_PERMISSIONS.create);
  const canCreate = offered && mayCreateQuote;
  const designStatus = designStatusLabel(view.designStatus);
  return (
    <div className="space-y-1">
      <div className="font-medium">{view.title ?? "Thiết kế"}</div>
      {view.scope === "DESIGN" ? (
        <div className="text-ink-secondary">
          {view.cartons != null && `${view.cartons} thùng`}
          {view.desiredDeliveryDate && ` · giao mong muốn ${formatDate(view.desiredDeliveryDate)}`}
          {designStatus && ` · ${designStatus}`}
        </div>
      ) : (
        <ul className="text-ink-secondary">
          {view.lines.map((line, i) => (
            <li key={i}>
              {line.designName} — {line.cartons} thùng (
              {designStatusLabel(line.designStatus) ?? CHAT_UNKNOWN_LABELS.designStatus})
            </li>
          ))}
        </ul>
      )}
      {view.returnReason && (
        <div className="text-warning-ink">Lý do trả lại: {view.returnReason}</div>
      )}
      {view.quoteId && (
        // AUTH-8: thiếu quyền mở trang báo giá thì chỉ hiện chữ
        <PermittedLink
          permission={QUOTE_PERMISSIONS.viewPage}
          href={ADMIN_ROUTES.quotes.detail(view.quoteId)}
          className="text-accent-text hover:underline"
          plainClassName="text-ink-secondary block"
        >
          Báo giá {view.quoteNumber ?? ""}
        </PermittedLink>
      )}
      {!offered && !view.quoteId && card.state === "OPEN" && waitNote && (
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
