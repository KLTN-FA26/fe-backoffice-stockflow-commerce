"use client";

import { useEffect } from "react";

import { CHAT_PERMISSIONS, CHAT_STATUS_LABELS, CHAT_STATUS_TONE_KEY } from "@/constants";
import { useAuthStore, usePermissionChecker } from "@/lib/auth";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { Card } from "@/components/shared/Card";
import { Notice } from "@/components/shared/Notice";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import {
  isEnded,
  notInChargeHint,
  staffConversationActions,
  staffConversationTools,
} from "../lifecycle";
import { chatErrorMessage, useMarkRead } from "../mutations";
import { useConversation, useMessages } from "../queries";
import { useConversationRealtime } from "../realtime";

import { Composer } from "./Composer";
import { ConversationActions } from "./ConversationActions";
import { CustomerPanel } from "./CustomerPanel";
import { MessageList } from "./MessageList";

function ConversationContent({ id }: { id: string }) {
  const can = usePermissionChecker();
  const meId = useAuthStore((state) => state.user?.userId ?? null);
  const canRead = can(CHAT_PERMISSIONS.read);
  const conversation = useConversation(id, canRead);
  const messages = useMessages(id, canRead);
  // Socket events of this conversation, once the GET found it (A.3).
  useConversationRealtime(id, conversation.isSuccess);
  const read = useMarkRead();
  const lastSeq = conversation.data?.lastSeq ?? 0;
  const unread = conversation.data?.unread ?? 0;
  const { mutate: markRead } = read;
  useBreadcrumbLabel(
    id,
    conversation.data?.subject ?? conversation.data?.customerName ?? undefined,
  );
  // Đánh dấu đã đọc khi có tin mới (marker BE không lùi).
  useEffect(() => {
    if (unread > 0 && can(CHAT_PERMISSIONS.update)) markRead({ id, seq: lastSeq });
  }, [can, id, lastSeq, markRead, unread]);

  if (!canRead) return <Notice tone="warning">Bạn không có quyền xem hội thoại.</Notice>;
  if (conversation.isPending) return <PageSkeleton variant="detail" />;
  if (conversation.isError)
    return (
      <Notice tone="danger">
        {chatErrorMessage(conversation.error)}{" "}
        <Button size="sm" variant="outline" onClick={() => void conversation.refetch()}>
          Thử lại
        </Button>
      </Notice>
    );
  const data = conversation.data;
  const actions = staffConversationActions(data, meId, can);
  const tools = staffConversationTools(data, meId, can);
  const hint = can(CHAT_PERMISSIONS.update) ? notInChargeHint(data, meId, can) : null;
  const quoteGate = {
    allowed: tools.createQuote,
    hint: !can(CHAT_PERMISSIONS.update)
      ? "Bạn chỉ có quyền xem hội thoại này."
      : isEnded(data.status)
        ? "Hội thoại đã kết thúc."
        : hint,
  };

  return (
    <div className="surface-soft surface-compact">
      <h1 className="sr-only">Hội thoại {data.subject ?? data.customerName}</h1>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-ink-primary text-sm font-semibold">
                {data.subject ?? "Hội thoại"}
              </div>
              <div className="text-ink-tertiary text-xs">
                {data.customerName} ·{" "}
                {data.assignedAgentName ? `Phụ trách: ${data.assignedAgentName}` : "Chưa phân công"}
              </div>
            </div>
            <StatusDot
              domain="order"
              status={CHAT_STATUS_TONE_KEY[data.status]}
              label={CHAT_STATUS_LABELS[data.status]}
            />
          </div>
          <ConversationActions
            conversationId={id}
            assignedAgentId={data.assignedAgentId}
            actions={actions}
            tools={tools}
            blockedHint={isEnded(data.status) ? null : hint}
          />
          {messages.isPending ? (
            <p className="text-ink-tertiary text-[0.8125rem]">Đang tải tin nhắn…</p>
          ) : messages.isError ? (
            <Notice tone="danger">{chatErrorMessage(messages.error)}</Notice>
          ) : messages.data.items.length === 0 ? (
            <p className="text-ink-tertiary text-[0.8125rem]">Chưa có tin nhắn.</p>
          ) : (
            <MessageList
              key={id}
              conversationId={id}
              customerId={data.customerId}
              latest={messages.data}
              quoteGate={quoteGate}
            />
          )}
          <Composer
            conversationId={id}
            canReply={actions.reply}
            canNote={actions.note}
            canUseCanned={tools.canned}
            replyBlockedHint={isEnded(data.status) ? null : hint}
          />
        </Card>
        <CustomerPanel conversation={data} canSend={actions.reply} canAttach={tools.attach} />
      </div>
    </div>
  );
}

/** Chi tiết hội thoại của Sale (WF-02 pha E2): tin + thẻ, nhận / đổi trạng thái, gửi chữ / file / ghi chú. */
export function ChatConversationScreen({ id }: { id: string }) {
  return (
    <PermissionBoundary permissions={[CHAT_PERMISSIONS.viewPage]}>
      <ConversationContent id={id} />
    </PermissionBoundary>
  );
}
