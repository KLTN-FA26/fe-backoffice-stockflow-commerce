"use client";

import { useState } from "react";

import { CHAT_STATUS_LABELS } from "@/constants";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import { chatErrorMessage, useChangeStatus, useClaimConversation } from "../mutations";

import type { ChatConversationStatus } from "@/constants";
import type { StaffConversationActions } from "../lifecycle";

/** Nhận hội thoại + đổi trạng thái theo `nextStatuses` của BE; chuyển cấp (ESCALATED) bắt buộc lý do. */
export function ConversationActions({
  conversationId,
  actions,
}: {
  conversationId: string;
  actions: StaffConversationActions;
}) {
  const claim = useClaimConversation();
  const change = useChangeStatus();
  const [escalating, setEscalating] = useState(false);
  const onError = (error: unknown) => toast.error(chatErrorMessage(error));
  const move = (status: ChatConversationStatus, reason?: string) =>
    change.mutate(
      { id: conversationId, status, reason },
      { onError, onSuccess: () => setEscalating(false) },
    );

  return (
    <div className="flex flex-wrap gap-2">
      {actions.claim && (
        <Button
          size="sm"
          disabled={claim.isPending}
          onClick={() => claim.mutate({ id: conversationId }, { onError })}
        >
          Nhận hội thoại
        </Button>
      )}
      {actions.moves.map((status) => (
        <Button
          key={status}
          size="sm"
          variant="outline"
          disabled={change.isPending}
          onClick={() => (status === "ESCALATED" ? setEscalating(true) : move(status))}
        >
          {CHAT_STATUS_LABELS[status]}
        </Button>
      ))}
      <ConfirmDialog
        open={escalating}
        onOpenChange={setEscalating}
        title="Chuyển cấp hội thoại?"
        description="Quản lý chat sẽ tiếp nhận. Ghi rõ lý do."
        confirmLabel="Chuyển cấp"
        variant="default"
        requireReason
        reasonLabel="Lý do"
        reasonMaxLength={1000}
        loading={change.isPending}
        closeOnConfirm={false}
        onConfirm={(reason) => move("ESCALATED", reason ?? "")}
      />
    </div>
  );
}
