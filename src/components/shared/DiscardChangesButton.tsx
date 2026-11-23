"use client";

import { useState } from "react";

import { UI_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";

import { ConfirmDialog } from "./ConfirmDialog";

import type { ComponentProps } from "react";

const L = UI_LABELS.discardChanges;

/**
 * Nút rời form không lưu (BO-UX-5): nhãn "Bỏ thay đổi" để không lẫn với "Huỷ báo giá / Huỷ hợp đồng" (huỷ chứng từ).
 * Form còn thay đổi chưa lưu (`dirty`) thì hỏi lại bằng ConfirmDialog; sạch thì rời ngay. Đóng tab / tải lại trang do
 * `useUnsavedChangesWarning` (beforeunload) của form lo.
 */
export function DiscardChangesButton({
  dirty,
  onDiscard,
  label = L.button,
  ...buttonProps
}: {
  dirty: boolean;
  onDiscard: () => void;
  label?: string;
} & Omit<ComponentProps<typeof Button>, "onClick" | "type" | "children">) {
  const [asking, setAsking] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        {...buttonProps}
        onClick={() => (dirty ? setAsking(true) : onDiscard())}
      >
        {label}
      </Button>
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={L.title}
        description={L.description}
        confirmLabel={L.confirm}
        cancelLabel={L.keepEditing}
        variant="danger"
        onConfirm={onDiscard}
      />
    </>
  );
}
