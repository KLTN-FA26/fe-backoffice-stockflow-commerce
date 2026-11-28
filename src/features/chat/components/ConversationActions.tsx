"use client";

import { useState } from "react";

import { SALES_OWNER_ACCESS_LABELS } from "@/constants";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import { useChangeStatus, useChatFailure, useClaimConversation } from "../mutations";

import { AssignDialog } from "./AssignDialog";
import { StatusMoveMenu } from "./StatusMoveMenu";

import type { ChatConversationStatus } from "@/constants";
import type { SalesOwnerAccess } from "@/lib/references/sales-owner-access";
import type { StaffConversationActions, StaffConversationTools } from "../lifecycle";

/**
 * Nhận hội thoại, giao / chuyển cho Sale khác (S11), đổi trạng thái theo `nextStatuses` của BE trong menu "Đổi trạng
 * thái" (BO-UX-44, `StatusMoveMenu`); chuyển cấp (ESCALATED) bắt buộc lý do.
 * BR-S05: "Nhận" hội thoại của khách chưa có chủ thì người nhận thành Sale phụ trách — nói trước dưới nút; khách đã có chủ
 * (người khác) thì nút tắt, nêu người phụ trách (BE 409 CUSTOMER_UNASSIGNED_CLAIM_ONLY).
 */
export function ConversationActions({
  conversationId,
  assignedAgentId,
  actions,
  tools,
  blockedHint,
  owner,
}: {
  conversationId: string;
  assignedAgentId: string | null | undefined;
  actions: StaffConversationActions;
  tools: StaffConversationTools;
  /** Không phải người phụ trách: giải thích vì sao các nút bị tắt (`notInChargeHint`). */
  blockedHint: string | null;
  /** Người phụ trách của khách (không biết → hành vi cũ). */
  owner?: Pick<SalesOwnerAccess, "known" | "owned" | "mine" | "ownerName">;
}) {
  const failure = useChatFailure(owner?.ownerName);
  const claimBlocked =
    owner?.known && owner.owned && !owner.mine
      ? owner.ownerName
        ? SALES_OWNER_ACCESS_LABELS.claimOwned(owner.ownerName)
        : SALES_OWNER_ACCESS_LABELS.claimOwnedUnnamed
      : null;
  const claimMakesOwner = owner?.known && !owner.owned;
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
          disabled={claim.isPending || !!claimBlocked}
          title={claimBlocked ?? undefined}
          aria-describedby={claimBlocked || claimMakesOwner ? "chat-claim-note" : undefined}
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
      {actions.claim && (claimBlocked || claimMakesOwner) && (
        <p id="chat-claim-note" className="text-ink-secondary w-full text-xs">
          {claimBlocked ?? SALES_OWNER_ACCESS_LABELS.claimMakesOwner}
        </p>
      )}
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
