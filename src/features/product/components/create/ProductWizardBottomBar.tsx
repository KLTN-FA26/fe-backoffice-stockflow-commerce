"use client";

import { ArrowRight, Save } from "lucide-react";

import { UI_LABELS } from "@/constants";

import { Button } from "@/components/ui/button";

import type { ProductWizard } from "./useProductWizard";

/** Thanh dưới cố định — "Quay lại" / "Tiếp tục", bước cuối là "Tạo bản nháp" / "Lưu thay đổi". */
export function ProductWizardBottomBar({
  wizard,
  isEditing,
  isPending,
  onSubmit,
}: {
  wizard: ProductWizard;
  isEditing: boolean;
  isPending: boolean;
  onSubmit: () => void;
}) {
  const L = UI_LABELS.product.wizard;
  const submitLabel = isPending ? L.saving : isEditing ? L.save : L.create;
  return (
    <div className="border-border-default bg-bg-surface/95 fixed right-0 bottom-0 left-0 z-40 border-t px-4 py-3 backdrop-blur lg:left-[240px]">
      <div className="flex items-center justify-between gap-3">
        <div className="text-ink-tertiary text-xs">
          Bước {wizard.currentIndex + 1}/{wizard.steps.length} ·{" "}
          {wizard.steps[wizard.currentIndex]?.label}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={wizard.goBack}
            disabled={wizard.currentIndex === 0}
            className="border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted rounded-[var(--r-sm)] disabled:opacity-40"
          >
            {UI_LABELS.common.back}
          </Button>
          {wizard.isLast ? (
            <Button
              type="button"
              size="sm"
              onClick={onSubmit}
              disabled={isPending}
              className="bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse inline-flex items-center gap-1.5 rounded-[var(--r-sm)]"
            >
              <Save className="size-3.5" />
              {submitLabel}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={() => void wizard.goNext()}
              className="bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse inline-flex items-center gap-1.5 rounded-[var(--r-sm)]"
            >
              {L.next}
              <ArrowRight className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
