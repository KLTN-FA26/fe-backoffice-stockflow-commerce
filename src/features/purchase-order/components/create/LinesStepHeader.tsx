"use client";

import { ListChecks, Maximize2, Minimize2, Plus } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";

import type { CreatePoWizard } from "./useCreateForm";

const S = UI_LABELS.purchaseOrder.linesStep;
const BTN =
  "border-border-default bg-bg-surface text-ink-primary hover:bg-bg-muted h-8 gap-1.5 rounded-[var(--action-radius)] px-3 text-[0.8125rem] font-medium shadow-(--control-shadow)";

/** Tiêu đề bước Dòng hàng + số dòng/lỗi + nút thêm nhiều SKU, mở rộng, thêm dòng. */
export function LinesStepHeader({
  w,
  summary,
  expanded,
  onToggleExpanded,
  canAdd,
  canAddMany,
  onAdd,
  onAddMany,
}: {
  w: CreatePoWizard;
  summary: string;
  expanded: boolean;
  onToggleExpanded: () => void;
  canAdd: boolean;
  canAddMany: boolean;
  onAdd: () => void;
  onAddMany: () => void;
}) {
  const noCatalog = w.mode === "edit" && !w.catalog.canRead;
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h2 className="text-ink-primary font-[family-name:var(--font-display)] text-[1rem] font-semibold">
          {S.title}
          <span className="text-ink-tertiary ml-2 text-[0.8125rem] font-normal" role="status">
            {summary}
          </span>
        </h2>
        <p className="text-ink-secondary mt-1 max-w-[68ch] text-[0.8125rem]">
          {noCatalog
            ? S.editDescriptionNoCatalog
            : w.mode === "edit"
              ? S.editDescription
              : S.description}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onAddMany}
          disabled={!canAddMany}
          className={BTN}
        >
          <ListChecks className="text-dot-special size-3.5" />
          {S.addMany}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onToggleExpanded}
          aria-pressed={expanded}
          className={BTN}
        >
          {expanded ? (
            <Minimize2 className="text-dot-info size-3.5" />
          ) : (
            <Maximize2 className="text-dot-info size-3.5" />
          )}
          {expanded ? S.collapse : S.expand}
        </Button>
        <Button type="button" variant="outline" onClick={onAdd} disabled={!canAdd} className={BTN}>
          <Plus className="size-3.5" />
          {S.add}
        </Button>
      </div>
    </div>
  );
}
