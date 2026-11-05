"use client";

import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";

import { ADMIN_ROUTES, TOAST_MESSAGES } from "@/constants";
import { supplierFieldErrors } from "@/features/supplier/errors";
import { useCreateSupplier, useUpdateSupplier } from "@/features/supplier/mutations";
import { supplierFormSchema } from "@/features/supplier/schemas";
import { SUPPLIER_FORM_DEFAULTS, supplierToFormValues } from "@/features/supplier/selectors";
import { toast } from "@/components/shared/Toast";

import { STEPS } from "./wizard-constants";
import {
  earliestStep,
  fieldsOfStep,
  firstMessageForStep,
  issuesByStep,
  stepForErrors,
} from "./wizard-field-map";

import type { FieldErrors } from "react-hook-form";
import type { ApiError } from "@/lib/api/error";
import type { SupplierDto, SupplierFormValues } from "@/features/supplier/types";
import type { StepKey } from "./wizard-constants";

export type StepStatus = "active" | "done" | "error" | "idle";

const ALL_STEPS = new Set<StepKey>(STEPS.map((s) => s.key));

export function useSupplierWizard(existingSupplier?: SupplierDto) {
  const router = useRouter();
  const isEdit = Boolean(existingSupplier);
  const { mutate: createSupplier, isPending: isCreating } = useCreateSupplier();
  const { mutate: updateSupplier, isPending: isUpdating } = useUpdateSupplier();
  const isPending = isCreating || isUpdating;

  const [currentStep, setCurrentStep] = useState<StepKey>("profile");
  // Bước đã qua "Tiếp" hợp lệ. Sửa NCC: dữ liệu đã có sẵn → mở mọi bước.
  const [completedSteps, setCompletedSteps] = useState<Set<StepKey>>(() =>
    isEdit ? new Set(ALL_STEPS) : new Set(),
  );
  const [attemptedSteps, setAttemptedSteps] = useState<Set<StepKey>>(new Set());
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierFormSchema),
    mode: "onTouched",
    defaultValues: existingSupplier
      ? supplierToFormValues(existingSupplier)
      : SUPPLIER_FORM_DEFAULTS,
  });

  const { register, handleSubmit, setValue, setError, trigger, control, formState } = form;
  const { errors } = formState;
  const watchedValues = useWatch({ control }) as SupplierFormValues;
  const currentStepIndex = STEPS.findIndex((s) => s.key === currentStep);

  const validationByStep = useMemo(() => issuesByStep(errors), [errors]);
  const currentStepIssues = validationByStep.get(currentStep) ?? [];
  const showErrors = submitAttempted || attemptedSteps.has(currentStep);

  const stepStatus = (step: StepKey): StepStatus => {
    const hasIssues = (validationByStep.get(step) ?? []).length > 0;
    if (hasIssues && (submitAttempted || attemptedSteps.has(step))) return "error";
    if (step === currentStep) return "active";
    if (completedSteps.has(step) && !hasIssues) return "done";
    return "idle";
  };

  /**
   * Chỉ cho nhảy tới bước X khi mọi bước trước X đã qua "Tiếp" VÀ hiện không có lỗi — quay lại
   * sửa một bước đã ✓ thành sai thì phải sửa xong mới đi tiếp được.
   */
  const canGoTo = (step: StepKey): boolean => {
    const target = STEPS.findIndex((s) => s.key === step);
    return STEPS.slice(0, target).every(
      (s) => completedSteps.has(s.key) && (validationByStep.get(s.key) ?? []).length === 0,
    );
  };

  const goToStep = (step: StepKey) => {
    if (canGoTo(step)) setCurrentStep(step);
  };

  const goBack = () => setCurrentStep(STEPS[Math.max(currentStepIndex - 1, 0)]?.key ?? "profile");

  const goNext = async () => {
    setAttemptedSteps((prev) => new Set(prev).add(currentStep));
    const valid = await trigger(fieldsOfStep(currentStep));
    if (!valid) return;
    setCompletedSteps((prev) => new Set(prev).add(currentStep));
    const next = STEPS[currentStepIndex + 1];
    if (next) setCurrentStep(next.key);
  };

  // Lỗi server (409 trùng mã/MST, validate) → inline ở ô + nhảy về bước sớm nhất (SCRUM-389)
  const applyServerErrors = (err: ApiError) => {
    const fieldErrors = supplierFieldErrors(err, watchedValues.communicationChannel);
    for (const { field, message } of fieldErrors) setError(field, { type: "server", message });
    const step = earliestStep(fieldErrors.map((f) => f.field));
    if (step) setCurrentStep(step);
  };

  const onSubmit = (values: SupplierFormValues) => {
    if (existingSupplier) {
      updateSupplier(
        { id: existingSupplier.supplierId, values, status: existingSupplier.status },
        {
          onSuccess: () => router.push(ADMIN_ROUTES.suppliers.detail(existingSupplier.supplierId)),
          onError: applyServerErrors,
        },
      );
      return;
    }
    createSupplier(values, {
      onSuccess: (created) => {
        setConfirmOpen(false);
        router.push(ADMIN_ROUTES.suppliers.detail(created.supplierId));
      },
      onError: (err) => {
        setConfirmOpen(false);
        applyServerErrors(err);
      },
    });
  };

  const handleReviewSubmit = () => {
    setSubmitAttempted(true);
    void handleSubmit(
      (values) => {
        setCompletedSteps(new Set(ALL_STEPS));
        if (isEdit) onSubmit(values);
        else setConfirmOpen(true);
      },
      (errs: FieldErrors<SupplierFormValues>) => {
        const step = stepForErrors(errs);
        if (step) setCurrentStep(step);
        toast.error(
          TOAST_MESSAGES.form.saveBlocked,
          step ? firstMessageForStep(errs, step) : TOAST_MESSAGES.form.checkForm,
        );
      },
    )();
  };

  const handleConfirmCreate = () => void handleSubmit(onSubmit)();

  return {
    isEdit,
    isPending,
    currentStep,
    currentStepIndex,
    canGoTo,
    goToStep,
    goBack,
    goNext,
    confirmOpen,
    setConfirmOpen,
    register,
    handleSubmit,
    onSubmit,
    setValue,
    control,
    errors,
    watchedValues,
    validationByStep,
    currentStepIssues,
    showErrors,
    stepStatus,
    handleReviewSubmit,
    handleConfirmCreate,
  };
}

export type SupplierWizard = ReturnType<typeof useSupplierWizard>;
