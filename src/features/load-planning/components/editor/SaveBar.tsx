"use client";

import { useState } from "react";
import { Save } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { Alert } from "@/components/shared/Alert";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";

const S = UI_LABELS.loadPlan.editor.save;
const D = UI_LABELS.loadPlan.editor.discard;
const E = UI_LABELS.loadPlan.editor;

export interface SaveBarProps {
  dirty: boolean;
  saving: boolean;
  issueCount: number;
  /** Xe sẽ không còn kiện nào — BE bỏ khỏi kế hoạch. */
  emptiedSeqs: readonly number[];
  tooMany: boolean;
  onSave: () => void;
  onExit: () => void;
}

/**
 * Thanh lưu / thoát. Còn vi phạm phía trình duyệt thì hỏi lại trước khi gửi (máy chủ vẫn là nơi quyết định); thoát khi có
 * thay đổi chưa lưu thì hỏi bỏ.
 */
export function SaveBar({
  dirty,
  saving,
  issueCount,
  emptiedSeqs,
  tooMany,
  onSave,
  onExit,
}: SaveBarProps) {
  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  return (
    <div className="border-border-default space-y-2 border-t pt-3">
      {emptiedSeqs.length > 0 && (
        <Alert tone="warning">
          {S.emptiedVehicles(emptiedSeqs.map((seq) => `#${seq}`).join(", "))}
        </Alert>
      )}
      {tooMany && <Alert tone="danger">{S.tooMany}</Alert>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-ink-tertiary text-xs">{dirty ? S.dirty : S.clean}</span>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => (dirty ? setConfirmExit(true) : onExit())}
          >
            {E.exit}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!dirty || saving || tooMany}
            onClick={() => (issueCount > 0 ? setConfirmSend(true) : onSave())}
          >
            <Save aria-hidden />
            {saving ? S.saving : S.save}
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmSend}
        onOpenChange={setConfirmSend}
        title={S.confirmTitle}
        description={S.confirmDescription(issueCount)}
        confirmLabel={S.confirmSend}
        cancelLabel={D.keep}
        variant="default"
        onConfirm={onSave}
      />
      <ConfirmDialog
        open={confirmExit}
        onOpenChange={setConfirmExit}
        title={D.title}
        description={D.description}
        confirmLabel={D.confirm}
        cancelLabel={D.keep}
        onConfirm={onExit}
      />
    </div>
  );
}
