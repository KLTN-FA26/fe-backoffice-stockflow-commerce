"use client";

import { useState } from "react";

import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FORM_INPUT_CLASS, FormField } from "@/components/shared/FormField";
import { Textarea } from "@/components/ui/textarea";

import { chatErrorMessage, useAssignConversation, useChatFailure } from "../mutations";
import { useAgents } from "../queries";

/**
 * Giao (giám sát, hội thoại chưa ai nhận) hoặc chuyển hội thoại cho Sale khác (S11). Danh sách người trả lời khách
 * lấy từ S15; người đang phụ trách bị loại khỏi danh sách (BE trả `VALIDATION_FAILED` "đã là của họ").
 */
export function AssignDialog({
  conversationId,
  currentAgentId,
  mode,
  open,
  onOpenChange,
}: {
  conversationId: string;
  currentAgentId: string | null | undefined;
  mode: "assign" | "transfer";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const agents = useAgents(open);
  const assign = useAssignConversation();
  const describeError = useChatFailure();
  const [agentId, setAgentId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const close = () => {
    setAgentId("");
    setNote("");
    setError(null);
    onOpenChange(false);
  };
  const choices = (agents.data ?? []).filter((agent) => agent.userId !== currentAgentId);
  const title = mode === "assign" ? "Phân công hội thoại" : "Chuyển hội thoại";

  return (
    <FormDialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      {open && (
        <FormDialogBody
          title={title}
          description="Người nhận thấy hội thoại trong mục Của tôi; lịch sử và chứng từ đi theo hội thoại."
          submitLabel={mode === "assign" ? "Phân công" : "Chuyển"}
          canSubmit={!!agentId}
          isPending={assign.isPending}
          error={error ?? (agents.isError ? chatErrorMessage(agents.error) : null)}
          onCancel={close}
          onSubmit={() =>
            assign.mutate(
              { id: conversationId, agentId, note: note.trim() || undefined },
              { onSuccess: close, onError: (failure) => setError(describeError(failure)) },
            )
          }
        >
          <FormField id="assign-agent" label="Sale nhận" required>
            <select
              id="assign-agent"
              value={agentId}
              disabled={agents.isPending}
              onChange={(event) => setAgentId(event.target.value)}
              className={`${FORM_INPUT_CLASS} border px-2`}
            >
              <option value="">{agents.isPending ? "Đang tải…" : "Chọn Sale"}</option>
              {choices.map((agent) => (
                <option key={agent.userId} value={agent.userId}>
                  {agent.name}
                  {agent.online ? " · đang trực tuyến" : ""}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="assign-note" label="Ghi chú cho người nhận" hint="Không bắt buộc.">
            <Textarea
              id="assign-note"
              rows={2}
              maxLength={1000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </FormField>
        </FormDialogBody>
      )}
    </FormDialog>
  );
}
