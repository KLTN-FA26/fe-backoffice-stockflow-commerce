"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { ADMIN_ROUTES, TOAST_MESSAGES } from "@/constants";
import { toLocalIsoDate } from "@/lib/format";
import { useSupplierOptions } from "@/lib/references/supplier-options";
import {
  createPoSchema,
  poCreateFieldErrors,
  poCreateFormSchema,
  poErrorMessage,
  suggestExpectedDate,
  useCreatePo,
} from "@/features/purchase-order";
import { toast } from "@/components/shared/Toast";

import { calculateTotals } from "./helpers";
import { PO_CREATE_DEFAULTS, STEPS } from "./types";
import { earliestStep, fieldsOfStep, issuesByStep, stepForErrors } from "./wizard-field-map";

import type { FieldErrors } from "react-hook-form";
import type { ApiError } from "@/lib/api/error";
import type { CreatePoInput, PoCreateFormValues } from "@/features/purchase-order";
import type { StepKey, StepStatus } from "./types";

const MSG = TOAST_MESSAGES.purchaseOrder;
const ALL_STEPS = new Set<StepKey>(STEPS.map((s) => s.key));

function toCreateInput(v: PoCreateFormValues): CreatePoInput {
  return {
    supplierId: v.supplierId,
    currency: v.currency,
    expectedAt: v.expectedDate || null,
    lines: v.lines.map((l) => ({
      sku: l.skuId,
      description: l.description.trim(),
      quantityOrdered: Number(l.orderedQty),
      unitPrice: Number(l.unitPrice),
    })),
  };
}

/**
 * Wizard tạo PO — cùng cơ chế wizard NCC (`useSupplierWizard`): react-hook-form + zodResolver,
 * "Tiếp tục" chỉ đi khi các ô của bước hợp lệ, không nhảy cóc bước, lỗi BE hiện inline ở ô.
 */
export function useCreateForm() {
  const router = useRouter();
  const createPo = useCreatePo();
  // Nguồn NCC chung (lib/references): chỉ NCC ACTIVE, đã lọc ở server (BE #36).
  const suppliersQuery = useSupplierOptions();
  const suppliers = suppliersQuery.data ?? [];

  const [currentStep, setCurrentStep] = useState<StepKey>("info");
  // Bước đã qua "Tiếp tục" hợp lệ.
  const [completedSteps, setCompletedSteps] = useState<Set<StepKey>>(new Set());
  const [attemptedSteps, setAttemptedSteps] = useState<Set<StepKey>>(new Set());
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const form = useForm<PoCreateFormValues>({
    resolver: zodResolver(poCreateFormSchema),
    mode: "onTouched",
    defaultValues: PO_CREATE_DEFAULTS,
  });
  const { control, handleSubmit, setError, trigger, formState } = form;
  const lines = useFieldArray({ control, name: "lines" });
  // `useWatch` để re-render khi giá trị đổi; `getValues()` cho đủ kiểu (không cần ép `as`).
  useWatch({ control });
  const values = form.getValues();
  const currentStepIndex = STEPS.findIndex((s) => s.key === currentStep);

  const validationByStep = issuesByStep(formState.errors);
  const currentStepIssues = validationByStep.get(currentStep) ?? [];
  const showErrors = submitAttempted || attemptedSteps.has(currentStep);

  const stepStatus = (step: StepKey): StepStatus => {
    const hasIssues = (validationByStep.get(step) ?? []).length > 0;
    if (hasIssues && (submitAttempted || attemptedSteps.has(step))) return "error";
    if (step === currentStep) return "active";
    if (completedSteps.has(step) && !hasIssues) return "done";
    return "idle";
  };

  /** Chỉ nhảy tới bước X khi mọi bước trước X đã qua "Tiếp tục" VÀ hiện không có lỗi. */
  const canGoTo = (step: StepKey): boolean => {
    const target = STEPS.findIndex((s) => s.key === step);
    return STEPS.slice(0, target).every(
      (s) => completedSteps.has(s.key) && (validationByStep.get(s.key) ?? []).length === 0,
    );
  };
  const goToStep = (step: StepKey) => {
    if (canGoTo(step)) setCurrentStep(step);
  };
  const goBack = () => setCurrentStep(STEPS[Math.max(currentStepIndex - 1, 0)]?.key ?? "info");
  const goNext = async () => {
    setAttemptedSteps((prev) => new Set(prev).add(currentStep));
    const fields = fieldsOfStep(currentStep);
    const valid = fields.length === 0 || (await trigger(fields));
    if (!valid) return;
    setCompletedSteps((prev) => new Set(prev).add(currentStep));
    const next = STEPS[currentStepIndex + 1];
    if (next) setCurrentStep(next.key);
  };

  // Lỗi server → inline ở ô + về bước sớm nhất (như wizard NCC). Lỗi không gắn được ô → toast.
  const applyServerErrors = (err: ApiError) => {
    const fieldErrors = poCreateFieldErrors(err);
    for (const { field, message } of fieldErrors) setError(field, { type: "server", message });
    const step = earliestStep(fieldErrors.map((f) => f.field));
    if (step) {
      setAttemptedSteps((prev) => new Set(prev).add(step));
      setCurrentStep(step);
    }
    toast.error(MSG.actionFailed, fieldErrors[0]?.message ?? poErrorMessage(err));
  };

  const onCreate = (v: PoCreateFormValues) => {
    // Payload BE = chốt chặn cuối (cùng ràng buộc CreatePurchaseOrderRequest).
    const parsed = createPoSchema.safeParse(toCreateInput(v));
    if (!parsed.success) {
      setConfirmOpen(false);
      toast.error(TOAST_MESSAGES.form.checkForm, parsed.error.issues[0]?.message ?? "");
      return;
    }
    createPo.mutate(parsed.data, {
      onSuccess: (created) => {
        setConfirmOpen(false);
        if (created.possibleDuplicate) toast.warning(MSG.possibleDuplicate, created.poNumber);
        else toast.success(MSG.created, created.poNumber);
        const query = created.possibleDuplicate ? "?duplicate=1" : "";
        router.push(`${ADMIN_ROUTES.purchaseOrders.detail(created.poId)}${query}`);
      },
      onError: (err) => {
        setConfirmOpen(false);
        applyServerErrors(err);
      },
    });
  };

  const handleReviewSubmit = () => {
    if (createPo.isPending) return; // chặn double-submit
    setSubmitAttempted(true);
    void handleSubmit(
      () => {
        setCompletedSteps(new Set(ALL_STEPS));
        setConfirmOpen(true);
      },
      (errs: FieldErrors<PoCreateFormValues>) => {
        const step = stepForErrors(errs);
        if (step) setCurrentStep(step);
        const first = step ? issuesByStep(errs).get(step)?.[0] : undefined;
        toast.error(TOAST_MESSAGES.form.saveBlocked, first ?? TOAST_MESSAGES.form.checkForm);
      },
    )();
  };
  const handleConfirmCreate = () => void handleSubmit(onCreate)();

  const selectedSupplier = suppliers.find((s) => s.supplierId === values.supplierId);
  const today = toLocalIsoDate(new Date().toISOString());

  return {
    form,
    lines,
    values,
    errors: formState.errors,
    isSubmitting: createPo.isPending,
    currentStep,
    currentStepIndex,
    canGoTo,
    goToStep,
    goBack,
    goNext,
    stepStatus,
    showErrors,
    currentStepIssues,
    validationByStep,
    confirmOpen,
    setConfirmOpen,
    handleReviewSubmit,
    handleConfirmCreate,
    suppliersQuery,
    suppliers,
    selectedSupplier,
    today,
    suggestedDate: selectedSupplier
      ? suggestExpectedDate(today, selectedSupplier.leadTimeDays)
      : null,
    hasPrices: values.lines.some((l) => l.unitPrice.trim() !== ""),
    totals: calculateTotals(values.lines),
  };
}

export type CreatePoWizard = ReturnType<typeof useCreateForm>;
