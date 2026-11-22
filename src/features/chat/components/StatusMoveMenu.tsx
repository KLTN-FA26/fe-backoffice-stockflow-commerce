"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { DropdownMenu } from "radix-ui";

import { CHAT_STATUS_MENU_LABELS, CHAT_STATUS_MOVE_LABELS } from "@/constants";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";

import type { ChatConversationStatus } from "@/constants";

type ManualMove = keyof typeof CHAT_STATUS_MOVE_LABELS;

const isManualMove = (status: ChatConversationStatus): status is ManualMove =>
  status in CHAT_STATUS_MOVE_LABELS;

const ITEM =
  "text-ink-primary data-[highlighted]:bg-bg-muted flex cursor-pointer items-center rounded-[var(--r-sm)] px-2 py-1.5 text-[0.8125rem] outline-none";

/**
 * BO-UX-44: the conversation's status moves (BE `nextStatuses`, already filtered for the caller) as verbs in one
 * "Đổi trạng thái" menu — not buttons named like status badges. Escalating asks for the reason (the caller's dialog);
 * resolving ends the conversation, so it is confirmed first.
 */
export function StatusMoveMenu({
  moves,
  pending,
  onMove,
  onEscalate,
}: {
  moves: readonly ChatConversationStatus[];
  pending: boolean;
  onMove: (status: ChatConversationStatus) => void;
  onEscalate: () => void;
}) {
  const [resolving, setResolving] = useState(false);
  const items = moves.filter(isManualMove);
  if (items.length === 0) return null;
  const choose = (status: ManualMove) => {
    if (status === "ESCALATED") onEscalate();
    else if (status === "RESOLVED") setResolving(true);
    else onMove(status);
  };
  return (
    <>
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger asChild>
          <Button size="sm" variant="outline" disabled={pending}>
            {CHAT_STATUS_MENU_LABELS.trigger}
            <ChevronDown aria-hidden className="size-3.5" />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            sideOffset={4}
            className="border-border-default bg-bg-surface z-(--z-dropdown) min-w-56 rounded-[var(--r-sm)] border p-1 shadow-md"
          >
            {items.map((status) => (
              <DropdownMenu.Item key={status} className={ITEM} onSelect={() => choose(status)}>
                {CHAT_STATUS_MOVE_LABELS[status]}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <ConfirmDialog
        open={resolving}
        onOpenChange={setResolving}
        title={CHAT_STATUS_MENU_LABELS.resolveTitle}
        description={CHAT_STATUS_MENU_LABELS.resolveDescription}
        confirmLabel={CHAT_STATUS_MENU_LABELS.resolveConfirm}
        variant="default"
        loading={pending}
        onConfirm={() => onMove("RESOLVED")}
      />
    </>
  );
}
