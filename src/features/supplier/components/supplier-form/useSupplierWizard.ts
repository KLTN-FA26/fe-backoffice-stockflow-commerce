"use client";

import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";

import { ADMIN_ROUTES, TOAST_MESSAGES } from "@/constants";
import { useCreateSupplier, useUpdateSupplier } from "@/features/supplier/mutations";
import { supplierCreateInputSchema } from "@/features/supplier/schemas";
import { toast } from "@/components/shared/Toast";

import { STEPS } from "./wizard-constants";
import {
  FIELD_STEP_MAP,
  firstMessageForStep,
  messageAt,
  resolveServerFieldErrors,
  stepForErrors,
} from "./wizard-field-map";

import type { FieldErrors } from "react-hook-form";
import type { ApiError } from "@/lib/api/error";
import type { SupplierCreateInput, SupplierDto } from "@/features/supplier/types";
import type { StepKey } from "./wizard-constants";

export function useSupplierWizard(existingSupplier?: SupplierDto) {
  const router = useRouter();
  const isEdit = Boolean(existingSupplier);
  const { mutate: createSupplier, isPending: isCreating } = useCreateSupplier();
  const { mutate: updateSupplier, isPending: isUpdating } = useUpdateSupplier();
  const isPending = isCreating || isUpdating;

  const [currentStep, setCurrentStep] = useState<StepKey>("profile");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<SupplierCreateInput>({
    resolver: zodResolver(supplierCreateInputSchema),
    defaultValues: isEdit
      ? {
          // BE code; mock dùng supplierId làm code (xem comment supplierDtoSchema)
          code: existingSupplier?.code ?? existingSupplier?.supplierId,
          name: existingSupplier?.name ?? "",
          taxCode: existingSupplier?.taxCode ?? "",
          contactName: existingSupplier?.contactName ?? "",
          contactEmail: existingSupplier?.contactEmail ?? "",
          contactPhone: existingSupplier?.contactPhone ?? "",
          address: existingSupplier?.address ?? {
            street: "",
            ward: "",
            district: "",
            province: "",
            postalCode: "",
            country: "VN" as const,
          },
          paymentTerms: existingSupplier?.paymentTerms,
          currency: existingSupplier?.currency,
          leadTimeDays: existingSupplier?.leadTimeDays,
        }
      : {
          name: "",
          taxCode: "",
          contactName: "",
          contactEmail: "",
          contactPhone: "",
          address: {
            street: "",
            ward: "",
            district: "",
            province: "",
            postalCode: "",
            country: "VN",
          },
          paymentTerms: "Net 30",
          currency: "VND",
          leadTimeDays: 14,
        },
  });

  const { register, handleSubmit, setValue, setError, control, formState } = form;
  const { errors } = formState;
  const watchedValues = useWatch({ control }) as SupplierCreateInput;
  const currentStepIndex = STEPS.findIndex((s) => s.key === currentStep);

  const validationByStep = useMemo(() => {
    const map = new Map<StepKey, string[]>();
    const add = (step: StepKey, msg: string) => map.set(step, [...(map.get(step) ?? []), msg]);
    for (const [field, step] of Object.entries(FIELD_STEP_MAP)) {
      const msg = messageAt(errors, field);
      if (msg) add(step, msg);
    }
    return map;
  }, [errors]);

  const currentStepIssues = validationByStep.get(currentStep) ?? [];
  const showErrors = submitAttempted || currentStep === "terms";
  const stepStatus = (step: StepKey) => {
    if ((validationByStep.get(step) ?? []).length > 0 && submitAttempted) return "error";
    if (STEPS.findIndex((s) => s.key === step) < currentStepIndex || submitted) return "done";
    if (step === currentStep) return "active";
    return "idle";
  };

  // Lỗi server (409 trùng code/taxCode…) → inline ở ô + nhảy về bước sớm nhất (SCRUM-389)
  const applyServerErrors = (err: ApiError) => {
    if (!err.fieldErrors) return;
    const { fields, step } = resolveServerFieldErrors(err.fieldErrors);
    for (const { path, message } of fields) setError(path, { type: "server", message });
    if (step) setCurrentStep(step);
  };

  const onSubmit = (data: SupplierCreateInput) => {
    if (isEdit && existingSupplier) {
      updateSupplier(
        { ...data, id: existingSupplier.supplierId },
        {
          onSuccess: () => router.push(ADMIN_ROUTES.suppliers.detail(existingSupplier.supplierId)),
          onError: applyServerErrors,
        },
      );
    } else {
      createSupplier(data, {
        onSuccess: (created) => {
          setSubmitted(true);
          setConfirmOpen(false);
          toast.success("Đã tạo nhà cung cấp", `${created.supplierId} — ${created.name}`);
          router.push(ADMIN_ROUTES.suppliers.detail(created.supplierId));
        },
        onError: applyServerErrors,
      });
    }
  };

  const handleReviewSubmit = () => {
    setSubmitAttempted(true);
    void handleSubmit(
      (data) => {
        if (isEdit) onSubmit(data);
        else setConfirmOpen(true);
      },
      (errs) => {
        const typed = errs as FieldErrors<SupplierCreateInput>;
        const step = stepForErrors(typed);
        if (step) {
          setCurrentStep(step);
          toast.error(TOAST_MESSAGES.form.saveBlocked, firstMessageForStep(typed, step));
        } else {
          toast.error(TOAST_MESSAGES.form.saveBlocked, TOAST_MESSAGES.form.checkForm);
        }
      },
    )();
  };

  const handleConfirmCreate = () => void handleSubmit(onSubmit)();

  return {
    isEdit,
    isPending,
    currentStep,
    setCurrentStep,
    currentStepIndex,
    confirmOpen,
    setConfirmOpen,
    register,
    handleSubmit,
    onSubmit,
    setValue,
    control,
    errors,
    watchedValues,
    watchedCurrency: (watchedValues.currency as string) ?? "VND",
    validationByStep,
    currentStepIssues,
    showErrors,
    stepStatus,
    handleReviewSubmit,
    handleConfirmCreate,
  };
}
