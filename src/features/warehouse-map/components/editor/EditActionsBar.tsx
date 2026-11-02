"use client";

import { Loader2, Save, X } from "lucide-react";

import { UI_LABELS } from "@/constants";

import { TOOLBAR_ACTION_CLASS } from "@/components/shared/ListToolbar";
import { Button } from "@/components/ui/button";

import type { ReactNode } from "react";

const ED = UI_LABELS.warehouseMap.edit;
const OUTLINE = `${TOOLBAR_ACTION_CLASS} border-border-default bg-bg-surface text-ink-primary hover:bg-bg-muted border`;

export interface EditActionsBarProps {
  /** Thanh công cụ sửa, đứng bên trái hàng. */
  tools: ReactNode;
  changes: number;
  invalid: number;
  progress: { done: number; total: number } | null;
  onExit: () => void;
  onSave: () => void;
}

/**
 * Hàng trên của chế độ sửa: thanh công cụ sửa bên trái; góc phải là trạng thái bản nháp (đang lưu / số
 * hình chưa hợp lệ), Thoát và Lưu toàn bộ — nút hành động chính góc phải-trên (Mode A §4.3).
 */
export function EditActionsBar(props: EditActionsBarProps) {
  const saving = props.progress !== null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="min-w-0 flex-1">{props.tools}</div>
      <p role="status" className="text-xs tabular-nums">
        {props.progress ? (
          <span className="text-ink-secondary">
            {ED.saving(props.progress.done, props.progress.total)}
          </span>
        ) : props.invalid > 0 ? (
          <span className="text-danger">{ED.invalid(props.invalid)}</span>
        ) : null}
      </p>
      <Button type="button" size="sm" onClick={props.onExit} disabled={saving} className={OUTLINE}>
        <X className="size-3.5" /> {ED.cancel}
      </Button>
      <Button
        type="button"
        size="sm"
        onClick={props.onSave}
        disabled={saving || props.changes === 0 || props.invalid > 0}
        className={`${TOOLBAR_ACTION_CLASS} bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse`}
      >
        {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}{" "}
        {ED.save(props.changes)}
      </Button>
    </div>
  );
}
