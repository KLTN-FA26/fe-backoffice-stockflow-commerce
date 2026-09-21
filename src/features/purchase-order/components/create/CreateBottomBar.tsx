"use client";

import { ArrowRight, Save, Send } from "lucide-react";

import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import { STEPS, type StepKey } from "./types";

export function CreateBottomBar({
  currentStep,
  currentStepIndex,
  onBack,
  onNext,
  onSubmit,
}: {
  currentStep: StepKey;
  currentStepIndex: number;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="border-border-default bg-bg-surface/95 fixed right-0 bottom-0 left-0 z-40 border-t px-4 py-3 backdrop-blur lg:left-[240px]">
      <div className="flex items-center justify-between gap-3">
        <div className="text-ink-tertiary text-xs">
          Bước {currentStepIndex + 1}/{STEPS.length} · {STEPS[currentStepIndex]?.label}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              toast.success(
                "Đã lưu nháp",
                "Dữ liệu PO mock được giữ trong phiên làm việc hiện tại.",
              )
            }
            className="border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted hover:text-ink-primary inline-flex items-center gap-1.5 rounded-[var(--r-sm)] border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors"
          >
            <Save className="size-3.5" />
            Lưu nháp
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onBack}
            disabled={currentStepIndex === 0}
            className="border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted rounded-[var(--r-sm)] border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors disabled:opacity-40"
          >
            Quay lại
          </Button>
          {currentStep !== "review" ? (
            <Button
              variant="default"
              type="button"
              size="sm"
              onClick={onNext}
              className="bg-brand !text-ink-inverse hover:bg-brand-hover hover:!text-ink-inverse inline-flex items-center gap-1.5 rounded-[var(--r-sm)] px-3 py-1.5 text-[0.8125rem] font-medium transition-colors"
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
              className="bg-brand !text-ink-inverse hover:bg-brand-hover hover:!text-ink-inverse inline-flex items-center gap-1.5 rounded-[var(--r-sm)] px-3 py-1.5 text-[0.8125rem] font-medium transition-colors"
            >
              <Send className="size-3.5" />
              Tạo PO
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
