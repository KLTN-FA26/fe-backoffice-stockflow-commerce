import { ArrowRight, Save, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/shared/Toast";

import type { StepKey } from "./wizard-constants";
import type { STEPS as StepsType } from "./wizard-constants";

export function WizardBottomBar({
  currentStepIndex,
  currentStep,
  steps,
  isPending,
  isEdit,
  onBack,
  onNext,
  onSubmit,
}: {
  currentStepIndex: number;
  currentStep: StepKey;
  steps: typeof StepsType;
  isPending: boolean;
  isEdit: boolean;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="border-border-default bg-bg-surface/95 fixed right-0 bottom-0 left-0 z-40 border-t px-4 py-3 backdrop-blur lg:left-[240px]">
      <div className="flex items-center justify-between gap-3">
        <div className="text-ink-tertiary text-xs">
          Bước {currentStepIndex + 1}/{steps.length} · {steps[currentStepIndex]?.label}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => toast.success("Đã lưu nháp", "Dữ liệu mock giữ trong phiên hiện tại.")}
            className="border-border-default bg-bg-surface text-ink-secondary hover:bg-bg-muted rounded-[var(--r-sm)] border px-3 py-1.5 text-[0.8125rem] font-medium"
          >
            <Save className="size-3.5" /> Lưu nháp
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onBack}
            disabled={currentStepIndex === 0}
            className="border-border-default bg-bg-surface text-ink-secondary rounded-[var(--r-sm)] border px-3 py-1.5 text-[0.8125rem] font-medium disabled:opacity-40"
          >
            Quay lại
          </Button>
          {currentStep !== "terms" ? (
            <Button
              type="button"
              size="sm"
              onClick={onNext}
              className="bg-brand !text-ink-inverse hover:bg-brand-hover rounded-[var(--r-sm)] px-3 py-1.5 text-[0.8125rem] font-medium"
            >
              Tiếp tục <ArrowRight className="size-3.5" />
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={onSubmit}
              disabled={isPending}
              className="bg-brand !text-ink-inverse hover:bg-brand-hover rounded-[var(--r-sm)] px-3 py-1.5 text-[0.8125rem] font-medium disabled:opacity-40"
            >
              <Send className="size-3.5" />{" "}
              {isPending ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Tạo nhà cung cấp"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
