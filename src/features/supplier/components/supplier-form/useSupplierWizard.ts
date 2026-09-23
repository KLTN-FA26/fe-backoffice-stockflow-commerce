"use client";

import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";

import { ADMIN_ROUTES } from "@/constants";
import { toast } from "@/components/shared/Toast";
import { supplierCreateInputSchema } from "@/features/supplier/schemas";
import { useCreateSupplier, useUpdateSupplier } from "@/features/supplier/mutations";

import type { SupplierCreateInput, SupplierDto } from "@/features/supplier/types";
import { STEPS, type StepKey } from "./wizard-constants";

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
          name: existingSupplier!.name,
          taxCode: existingSupplier!.taxCode,
          contactName: existingSupplier!.contactName,
          contactEmail: existingSupplier!.contactEmail,
          contactPhone: existingSupplier!.contactPhone,
          address: existingSupplier!.address ?? {
            street: "",
            ward: "",
            district: "",
            province: "",
            postalCode: "",
            country: "VN" as const,
          },
          paymentTerms: existingSupplier!.paymentTerms,
          currency: existingSupplier!.currency,
          leadTimeDays: existingSupplier!.leadTimeDays,
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
    if (errors.name) add("profile", errors.name.message ?? "Tên NCC không hợp lệ.");
    if (errors.taxCode) add("profile", errors.taxCode.message ?? "MST không hợp lệ.");
    if (errors.code) add("profile", errors.code.message ?? "Mã NCC không hợp lệ.");
    if (errors.contactName) add("contact", errors.contactName.message ?? "Người liên hệ bắt buộc.");
    if (errors.contactPhone) add("contact", errors.contactPhone.message ?? "SĐT không hợp lệ.");
    if (errors.contactEmail) add("contact", errors.contactEmail.message ?? "Email không hợp lệ.");
    if (errors.address?.street) add("address", errors.address.street.message ?? "Đường bắt buộc.");
    if (errors.address?.ward) add("address", errors.address.ward.message ?? "Phường/Xã bắt buộc.");
    if (errors.address?.district)
      add("address", errors.address.district.message ?? "Quận/Huyện bắt buộc.");
    if (errors.address?.province)
      add("address", errors.address.province.message ?? "Tỉnh/TP bắt buộc.");
    if (errors.address?.postalCode)
      add("address", errors.address.postalCode.message ?? "Mã bưu chính bắt buộc.");
    if (errors.paymentTerms)
      add("terms", errors.paymentTerms.message ?? "Điều khoản không hợp lệ.");
    if (errors.leadTimeDays) add("terms", errors.leadTimeDays.message ?? "Lead time không hợp lệ.");
    if (errors.currency) add("terms", errors.currency.message ?? "Tiền tệ không hợp lệ.");
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

  const onSubmit = (data: SupplierCreateInput) => {
    if (isEdit && existingSupplier) {
      updateSupplier(
        { ...data, id: existingSupplier.supplierId },
        {
          onSuccess: () => router.push(ADMIN_ROUTES.suppliers.detail(existingSupplier.supplierId)),
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
          const alias: Record<string, keyof SupplierCreateInput> = {
            email: "contactEmail",
            phone: "contactPhone",
          };
          for (const [field, message] of Object.entries(err.fieldErrors)) {
            const mapped = (alias[field] ?? field) as keyof SupplierCreateInput;
            if (mapped in supplierCreateInputSchema.shape || field in alias) {
              setError(mapped, { type: "server", message });
              if (["contactEmail", "contactPhone", "contactName"].includes(mapped))
                setCurrentStep("contact");
              else if (["name", "taxCode", "code"].includes(mapped)) setCurrentStep("profile");
            }
          }
        },
      });
    }
  };

  const handleReviewSubmit = () => {
    setSubmitAttempted(true);
    const mapErrorsToStep = (errs: typeof errors): StepKey | undefined => {
      if (errs.name || errs.taxCode || errs.code) return "profile";
      if (errs.contactName || errs.contactPhone || errs.contactEmail) return "contact";
      if (
        errs.address?.street ||
        errs.address?.ward ||
        errs.address?.district ||
        errs.address?.province ||
        errs.address?.postalCode
      )
        return "address";
      if (errs.paymentTerms || errs.leadTimeDays || errs.currency) return "terms";
      if (errs.address) return "address";
      return undefined;
    };
    const firstMessage = (errs: typeof errors, step: StepKey): string => {
      const m = validationByStep.get(step)?.[0];
      if (m) return m;
      // Fallback đọc trực tiếp từ errs (tươi từ onInvalid)
      if (step === "profile")
        return (
          errs.name?.message ?? errs.taxCode?.message ?? errs.code?.message ?? "Kiểm tra lại hồ sơ"
        );
      if (step === "contact")
        return (
          errs.contactName?.message ??
          errs.contactPhone?.message ??
          errs.contactEmail?.message ??
          "Kiểm tra lại liên hệ"
        );
      if (step === "address")
        return (
          errs.address?.street?.message ??
          errs.address?.ward?.message ??
          errs.address?.district?.message ??
          errs.address?.province?.message ??
          errs.address?.postalCode?.message ??
          "Kiểm tra lại địa chỉ"
        );
      return (
        errs.paymentTerms?.message ??
        errs.leadTimeDays?.message ??
        errs.currency?.message ??
        "Kiểm tra lại điều khoản"
      );
    };
    void handleSubmit(
      (data) => {
        if (isEdit) onSubmit(data);
        else setConfirmOpen(true);
      },
      (errs) => {
        const step = mapErrorsToStep(errs as typeof errors);
        if (step) {
          setCurrentStep(step);
          toast.error("Chưa thể lưu", firstMessage(errs as typeof errors, step));
        } else {
          // Fallback: nếu không map được, vẫn báo chung
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
