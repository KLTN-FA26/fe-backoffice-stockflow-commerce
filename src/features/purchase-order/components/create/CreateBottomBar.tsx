"use client";

import { ArrowRight, Send } from "lucide-react";

import { Button } from "@/components/ui/button";

import { STEPS, type StepKey } from "./types";

export function CreateBottomBar({
  currentStep,
  currentStepIndex,
  isPending,
  submitDisabled = false,
  submitLabel,
  pendingLabel,
  onBack,
  onNext,
  onSubmit,
}: {
  currentStep: StepKey;
  currentStepIndex: number;
  isPending: boolean;
  /** Khoá nút lưu mà không hiện "đang lưu" (vd đơn đã đổi trạng thái, không lưu được nữa). */
  submitDisabled?: boolean;
  /** "Tạo đơn đặt hàng" (tạo) / "Lưu thay đổi" (sửa nháp). */
  submitLabel: string;
  pendingLabel: string;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="border-border-default bg-bg-surface/95 fixed right-0 bottom-0 left-0 z-40 border-t px-4 py-3 backdrop-blur lg:left-(--sidebar-width) lg:group-has-data-[state=collapsed]/sidebar-wrapper:left-(--sidebar-width-icon)">
      <div className="flex items-center justify-between gap-3">
        <div className="text-ink-tertiary text-xs">
          Bước {currentStepIndex + 1}/{STEPS.length} · {STEPS[currentStepIndex]?.label}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onBack}
            disabled={currentStepIndex === 0}
            className="border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted h-(--action-h) rounded-(--action-radius) border px-(--action-px) text-[0.8125rem] font-medium transition-colors disabled:opacity-40"
          >
            Quay lại
          </Button>
          {currentStep !== "review" ? (
            <Button
              variant="default"
              type="button"
              size="sm"
              onClick={onNext}
              className="bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse inline-flex h-(--action-h) items-center gap-1.5 rounded-(--action-radius) px-(--action-px) text-[0.8125rem] font-medium transition-colors"
            >
              Tiếp tục
              <ArrowRight className="size-3.5" />
            </Button>
          ) : (
            <Button
              variant="default"
              type="button"
              size="sm"
              onClick={onSubmit}
              disabled={isPending || submitDisabled}
              className="bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse inline-flex h-(--action-h) items-center gap-1.5 rounded-(--action-radius) px-(--action-px) text-[0.8125rem] font-medium transition-colors"
            >
              <Send className="size-3.5" />
              {isPending ? pendingLabel : submitLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
