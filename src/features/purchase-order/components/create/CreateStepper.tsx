"use client";

import { Check } from "lucide-react";
import { cn } from "cn";

import { Card } from "@/components/shared/Card";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import { STEPS, type StepKey } from "./types";

export function CreateStepper({
  stepStatus,
  lineCount,
  onStepChange,
}: {
  stepStatus: (step: StepKey) => "error" | "done" | "active" | "idle";
  lineCount: number;
  onStepChange: (step: StepKey) => void;
}) {
  return (
    <Card className="h-fit p-0">
      <div className="border-border-default border-b px-4 py-3">
        <div className="text-ink-tertiary text-xs font-semibold tracking-[0.08em] uppercase">
          Quy trình
        </div>
        <div className="mt-1 flex items-center gap-2">
          <StatusDot domain="po" status="DRAFT" size="sm" withIcon />
          <span className="text-ink-tertiary text-xs">{lineCount} dòng hàng</span>
        </div>
      </div>
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
              className={cn(
                "mb-1 flex w-full justify-start gap-2 rounded-[var(--r-sm)] px-2.5 py-2 text-left text-[0.8125rem] transition-colors",
                status === "active" &&
                  "bg-brand text-ink-inverse hover:bg-brand hover:text-ink-inverse font-medium",
                status !== "active" &&
                  "text-ink-secondary hover:bg-bg-muted hover:text-ink-primary",
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
      </div>
    </Card>
  );
}
