"use client";

import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";

import { ADMIN_ROUTES } from "@/constants";
import { toast } from "@/components/shared/Toast";
import { supplierCreateInputSchema } from "@/features/supplier/schemas";
import { useCreateSupplier, useUpdateSupplier } from "@/features/supplier/mutations";

import { STEPS } from "./wizard-constants";
import {
  FIELD_ALIAS,
  FIELD_STEP_MAP,
  firstMessageForStep,
  stepForErrors,
} from "./wizard-field-map";

import type { FieldErrors } from "react-hook-form";
import type { SupplierCreateInput, SupplierDto } from "@/features/supplier/types";
import type { StepKey } from "./wizard-constants";

function messageAt(errs: FieldErrors<SupplierCreateInput>, path: string): string | undefined {
  const parts = path.split(".");
  let cur: unknown = errs;
  for (const part of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  if (cur && typeof cur === "object" && "message" in (cur as Record<string, unknown>)) {
    const m = (cur as Record<string, unknown>).message;
    return typeof m === "string" ? m : undefined;
  }
  return undefined;
}

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

  const applyFieldErrors = (fieldErrors: Record<string, string>) => {
    for (const [field, message] of Object.entries(fieldErrors)) {
      const mapped = (FIELD_ALIAS[field] ?? field) as keyof SupplierCreateInput;
      if (mapped in supplierCreateInputSchema.shape || field in FIELD_ALIAS) {
        setError(mapped, { type: "server", message });
        const step = FIELD_STEP_MAP[mapped as string] ?? FIELD_STEP_MAP[field];
        if (step) setCurrentStep(step);
      }
    }
  };

  const onSubmit = (data: SupplierCreateInput) => {
    if (isEdit && existingSupplier) {
      updateSupplier(
        { ...data, id: existingSupplier.supplierId },
        {
          onSuccess: () => router.push(ADMIN_ROUTES.suppliers.detail(existingSupplier.supplierId)),
          onError: (err) => {
            if (!err.fieldErrors) return;
            applyFieldErrors(err.fieldErrors);
          },
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
        onError: (err) => {
          if (!err.fieldErrors) return;
          applyFieldErrors(err.fieldErrors);
        },
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
          toast.error("Chưa thể lưu", firstMessageForStep(typed, step));
        } else {
          toast.error("Chưa thể lưu", "Kiểm tra lại biểu mẫu");
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
