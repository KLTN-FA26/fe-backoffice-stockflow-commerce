import { Check } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";

import { STEPS } from "./wizard-constants";

import type { StepStatus } from "./useSupplierWizard";
import type { StepKey } from "./wizard-constants";

export function WizardSidebar({
  stepStatus,
  canGoTo,
  onStepChange,
  isEdit,
}: {
  stepStatus: (step: StepKey) => StepStatus;
  canGoTo: (step: StepKey) => boolean;
  onStepChange: (step: StepKey) => void;
  isEdit: boolean;
}) {
  return (
    <div className="p-2">
      {STEPS.map((step, index) => {
        const Icon = step.icon;
        const status = stepStatus(step.key);
        return (
          <Button
            key={step.key}
            type="button"
            variant="ghost"
            onClick={() => onStepChange(step.key)}
            disabled={!canGoTo(step.key)}
            aria-current={status === "active" ? "step" : undefined}
            className={cn(
              "mb-1 flex w-full justify-start gap-2 rounded-[var(--r-sm)] px-2.5 py-2 text-left text-[0.8125rem] transition-colors",
              status === "active" &&
                "bg-brand text-ink-inverse hover:bg-brand hover:text-ink-inverse font-medium",
              status !== "active" && "text-ink-secondary hover:bg-bg-muted hover:text-ink-primary",
              status === "error" && "border-danger/30 bg-danger/5 text-danger border",
            )}
          >
            <span className="flex size-5 items-center justify-center rounded-full border border-current/20 text-[0.625rem]">
              {status === "done" ? <Check className="size-3" /> : index + 1}
            </span>
            <Icon className="size-3.5" />
            <span className="flex-1">{step.label}</span>
          </Button>
        );
      })}
      <div className="text-ink-tertiary mt-2 px-2 text-xs">{isEdit ? "Chỉnh sửa" : "Tạo mới"}</div>
    </div>
  );
}
