"use client";

import { useState } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import { useChangeStatus, useChatFailure, useClaimConversation } from "../mutations";

import { AssignDialog } from "./AssignDialog";
import { StatusMoveMenu } from "./StatusMoveMenu";

import type { ChatConversationStatus } from "@/constants";
import type { StaffConversationActions, StaffConversationTools } from "../lifecycle";

/**
 * Nhận hội thoại, giao / chuyển cho Sale khác (S11), đổi trạng thái theo `nextStatuses` của BE trong menu "Đổi trạng
 * thái" (BO-UX-44, `StatusMoveMenu`); chuyển cấp (ESCALATED) bắt buộc lý do.
 */
export function ConversationActions({
  conversationId,
  assignedAgentId,
  actions,
  tools,
  blockedHint,
}: {
  conversationId: string;
  assignedAgentId: string | null | undefined;
  actions: StaffConversationActions;
  tools: StaffConversationTools;
  /** Không phải người phụ trách: giải thích vì sao các nút bị tắt (`notInChargeHint`). */
  blockedHint: string | null;
}) {
  const failure = useChatFailure();
  const claim = useClaimConversation();
  const change = useChangeStatus();
  const [escalating, setEscalating] = useState(false);
  const [handing, setHanding] = useState(false);
  const handMode = tools.assign ? "assign" : "transfer";
  const onError = (error: unknown) => toast.error(failure(error));
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
      {(tools.assign || tools.transfer) && (
        <Button size="sm" variant="outline" onClick={() => setHanding(true)}>
          {tools.assign ? "Phân công" : "Chuyển cho Sale khác"}
        </Button>
      )}
      {blockedHint && assignedAgentId && (
        <Button size="sm" variant="outline" disabled>
          Chuyển cho Sale khác
        </Button>
      )}
      <StatusMoveMenu
        moves={actions.moves}
        pending={change.isPending}
        onMove={(status) => move(status)}
        onEscalate={() => setEscalating(true)}
      />
      {blockedHint && <p className="text-ink-tertiary w-full text-xs">{blockedHint}</p>}
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
      <AssignDialog
        conversationId={conversationId}
        currentAgentId={assignedAgentId}
        mode={handMode}
        open={handing}
        onOpenChange={setHanding}
      />
    </div>
  );
}
