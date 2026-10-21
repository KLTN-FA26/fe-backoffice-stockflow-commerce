"use client";

import { useState } from "react";

import {
  PRODUCT_CREATE_STEPS,
  PRODUCT_EDIT_STEPS,
  earliestStep,
  fieldsOfStep,
  issuesByStep,
} from "./wizard-steps";

import type { FieldErrors, UseFormReturn } from "react-hook-form";
import type { ProductDraftFormValues } from "../../schemas";
import type { ProductStepKey, ProductStepStatus } from "./wizard-steps";

/**
 * Điều hướng wizard tạo / sửa sản phẩm — cùng cơ chế wizard PO / NCC: "Tiếp tục" chỉ đi khi các ô
 * của bước hợp lệ, không nhảy cóc tới bước sau khi bước trước chưa qua. Chỉ lo chuyển bước; lưu /
 * tạo vẫn ở `ProductCreate`. Sửa: dữ liệu đã có nên đi tự do giữa các bước.
 */
export function useProductWizard({
  form,
  isEditing,
  axesIssue,
}: {
  form: UseFormReturn<ProductDraftFormValues>;
  isEditing: boolean;
  /** Lý do chặn của bản nháp trục (`createAxesIssue`) — chặn qua bước trục. */
  axesIssue: string | null;
}) {
  const steps = isEditing ? PRODUCT_EDIT_STEPS : PRODUCT_CREATE_STEPS;
  const [currentStep, setCurrentStep] = useState<ProductStepKey>("info");
  const [completed, setCompleted] = useState<ReadonlySet<ProductStepKey>>(
    () => new Set(isEditing ? steps.map((s) => s.key) : []),
  );
  const [attempted, setAttempted] = useState<ReadonlySet<ProductStepKey>>(new Set());
  const index = steps.findIndex((s) => s.key === currentStep);

  const issues = issuesByStep(form.formState.errors);
  if (axesIssue && attempted.has("axes")) issues.set("axes", [axesIssue]);
  const hasIssues = (step: ProductStepKey) => (issues.get(step) ?? []).length > 0;

  const markAttempted = (step: ProductStepKey) => setAttempted((prev) => new Set(prev).add(step));
  const jumpTo = (step: ProductStepKey) => {
    markAttempted(step);
    setCurrentStep(step);
  };

  const stepStatus = (step: ProductStepKey): ProductStepStatus => {
    if (hasIssues(step) && attempted.has(step)) return "error";
    if (step === currentStep) return "active";
    return completed.has(step) && !hasIssues(step) ? "done" : "idle";
  };
  const canGoTo = (step: ProductStepKey) =>
    steps
      .slice(
        0,
        steps.findIndex((s) => s.key === step),
      )
      .every((s) => completed.has(s.key) && !hasIssues(s.key));

  const goNext = async () => {
    markAttempted(currentStep);
    const fields = fieldsOfStep(currentStep);
    const valid = fields.length === 0 || (await form.trigger(fields));
    if (!valid || (currentStep === "axes" && axesIssue)) return;
    setCompleted((prev) => new Set(prev).add(currentStep));
    const next = steps[index + 1];
    if (next) setCurrentStep(next.key);
  };

  return {
    steps,
    currentStep,
    currentIndex: index,
    isLast: index === steps.length - 1,
    /** Lỗi của bước đang đứng — chỉ hiện sau khi đã bấm "Tiếp tục" ở bước đó. */
    currentIssues: attempted.has(currentStep) ? (issues.get(currentStep) ?? []) : [],
    issues,
    stepStatus,
    canGoTo,
    goNext,
    goBack: () => setCurrentStep(steps[Math.max(index - 1, 0)]?.key ?? "info"),
    goToStep: (step: ProductStepKey) => canGoTo(step) && setCurrentStep(step),
    /** Đưa về bước sớm nhất trong `candidates` (lỗi BE theo ô, trục bị chặn…). */
    jumpToEarliest: (candidates: Iterable<ProductStepKey>) => {
      const step = earliestStep(candidates);
      if (step) jumpTo(step);
    },
    /** Lỗi zod khi bấm lưu ở bước cuối → về bước sớm nhất có lỗi. */
    jumpToErrors: (errors: FieldErrors<ProductDraftFormValues>) => {
      const step = earliestStep(issuesByStep(errors).keys());
      if (step) jumpTo(step);
    },
  };
}

export type ProductWizard = ReturnType<typeof useProductWizard>;
