"use client";

import { cn } from "cn";
import { CheckCircle, X } from "lucide-react";

import { STEPS, type StepKey } from "./wizard-constants";

export function ReviewChecklist({ getIssues }: { getIssues: (k: StepKey) => string[] }) {
  return (
    <div className="border-border-default mt-5 rounded-[var(--r-sm)] border">
      {STEPS.map((step) => {
        const issues = getIssues(step.key);
        return (
          <div
            key={step.key}
            className="border-border-default flex items-start gap-3 border-b px-3 py-2 last:border-b-0"
          >
            <div
              className={cn(
                "mt-0.5 flex size-5 items-center justify-center rounded-full",
                issues.length ? "bg-danger/10 text-danger" : "bg-positive/10 text-positive",
              )}
            >
              {issues.length ? <X className="size-3" /> : <CheckCircle className="size-3" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-ink-primary text-[0.8125rem] font-medium">{step.label}</div>
              {issues.length ? (
                <div className="text-danger mt-0.5 text-xs">{issues.join(" · ")}</div>
              ) : (
                <div className="text-ink-tertiary mt-0.5 text-xs">Sẵn sàng</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
