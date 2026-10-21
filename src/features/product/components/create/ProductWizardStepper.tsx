"use client";

import { Check } from "lucide-react";
import { cn } from "cn";

import { UI_LABELS } from "@/constants";

import { Card } from "@/components/shared/Card";
import { Button } from "@/components/ui/button";

import type { ProductWizard } from "./useProductWizard";

/** Stepper trái — cùng kiểu wizard PO / NCC: không nhảy cóc tới bước khi bước trước chưa qua. */
export function ProductWizardStepper({
  wizard,
  isEditing,
  summary,
}: {
  wizard: ProductWizard;
  isEditing: boolean;
  /** Dòng phụ dưới "Quy trình" (số SKU sẽ tạo / trục sửa ở trang chi tiết). */
  summary: string;
}) {
  return (
    <Card className="h-fit p-0">
      <div className="border-border-default border-b px-4 py-3">
        <div className="text-ink-tertiary text-xs font-semibold tracking-[0.08em] uppercase">
          {UI_LABELS.product.wizard.process}
        </div>
        <div className="text-ink-tertiary mt-1 text-xs">{summary}</div>
      </div>
      <nav
        aria-label={isEditing ? "Các bước sửa sản phẩm" : "Các bước tạo sản phẩm"}
        className="p-2"
      >
        {wizard.steps.map((step, index) => {
          const Icon = step.icon;
          const status = wizard.stepStatus(step.key);
          return (
            <Button
              key={step.key}
              type="button"
              variant="ghost"
              onClick={() => wizard.goToStep(step.key)}
              disabled={!wizard.canGoTo(step.key)}
              // Bước đang đứng kể cả khi đang báo lỗi (trạng thái "error" thay cho "active")
              aria-current={step.key === wizard.currentStep ? "step" : undefined}
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
      </nav>
    </Card>
  );
}
