"use client";

import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { PO_LIMITS, TOAST_MESSAGES } from "@/constants";
import { toLocalIsoDate } from "@/lib/format";
import { useSupplierOptions } from "@/lib/references/supplier-options";
import { useWarehouseOptions } from "@/lib/references/warehouse-options";
import {
  effectiveUnitPrice,
  planLeadTimeDays,
  poCreateFieldErrors,
  poErrorMessage,
  poFormSchema,
  suggestExpectedDate,
} from "@/features/purchase-order";
import { toast } from "@/components/shared/Toast";

import { calculateTotals, warehouseOutsideList } from "./helpers";
import { STEPS } from "./types";
import { usePoCatalog } from "./usePoCatalog";
import { earliestStep, fieldsOfStep, issuesByStep, stepForErrors } from "./wizard-field-map";

import type { FieldErrors } from "react-hook-form";
import type { ApiError } from "@/lib/api/error";
import type { PoCreateFormValues } from "@/features/purchase-order";
import type { PoWizardOptions, StepKey, StepStatus } from "./types";

const MSG = TOAST_MESSAGES.purchaseOrder;
const ALL_STEPS = new Set<StepKey>(STEPS.map((s) => s.key));

/**
 * Lõi wizard PO (tạo + sửa nháp) — cùng cơ chế wizard NCC (`useSupplierWizard`): react-hook-form + zodResolver,
 * "Tiếp tục" chỉ đi khi các ô của bước hợp lệ, không nhảy cóc bước, lỗi BE hiện inline ở ô.
 */
export function usePoWizard({
  mode,
  defaults,
  minExpectedDate,
  currentWarehouse,
  savedLinesWithoutTerms,
  blocked = false,
  isSubmitting,
  onConfirm,
}: PoWizardOptions) {
  // Nguồn NCC chung (lib/references): chỉ NCC ACTIVE, đã lọc ở server (BE #36).
  const suppliersQuery = useSupplierOptions();
  const suppliers = suppliersQuery.data ?? [];
  // Kho nhận bắt buộc (SCRUM-390, BE PR #71): chỉ kho ACTIVE.
  const warehousesQuery = useWarehouseOptions();
  const warehouses = warehousesQuery.data ?? [];
  // Kho của nháp không có trong danh sách ACTIVE đang có → vẫn hiện để ô không trống. Chỉ kết luận
  // "không còn hoạt động" khi ĐÃ CÓ danh sách — đang tải/lỗi lần đầu thì rỗng, không phải bằng chứng.
  // Dựa vào `data` chứ không `isSuccess`: React Query v5 giữ data khi refetch nền lỗi (status "error").
  const keptWarehouse = warehouseOutsideList(warehouses, currentWarehouse);
  const inactiveWarehouse = warehousesQuery.data !== undefined ? keptWarehouse : null;
  const warehousesFailed = warehousesQuery.isError && !warehousesQuery.data;

  const [currentStep, setCurrentStep] = useState<StepKey>("info");
  // Bước đã qua "Tiếp tục" hợp lệ.
  const [completedSteps, setCompletedSteps] = useState<Set<StepKey>>(new Set());
  const [attemptedSteps, setAttemptedSteps] = useState<Set<StepKey>>(new Set());
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const form = useForm<PoCreateFormValues>({
    resolver: zodResolver(
      poFormSchema({
        requireExpectedDate: mode === "edit",
        currencyFixed: mode === "edit",
        maxLines: mode === "edit" ? PO_LIMITS.linesMax : undefined,
        savedLinesWithoutTerms,
        minExpectedDate,
      }),
    ),
    mode: "onTouched",
    defaultValues: defaults,
  });
  const { control, handleSubmit, setError, trigger, formState } = form;
  const lines = useFieldArray({ control, name: "lines" });
  // `useWatch` để re-render khi giá trị đổi; `getValues()` cho đủ kiểu (không cần ép `as`).
  useWatch({ control });
  const values = form.getValues();
  const currentStepIndex = STEPS.findIndex((s) => s.key === currentStep);
  const catalog = usePoCatalog(form, lines, values.supplierId);

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
    const fieldErrors = poCreateFieldErrors(err, form.getValues("lines"));
    for (const { field, message } of fieldErrors) setError(field, { type: "server", message });
    const step = earliestStep(fieldErrors.map((f) => f.field));
    if (step) {
      setAttemptedSteps((prev) => new Set(prev).add(step));
      setCurrentStep(step);
    }
    toast.error(MSG.actionFailed, fieldErrors[0]?.message ?? poErrorMessage(err));
  };

  const handleReviewSubmit = () => {
    if (isSubmitting || blocked) return; // chặn double-submit / đơn không lưu được nữa
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
  const handleConfirmCreate = () =>
    void handleSubmit((v) => onConfirm(v, applyServerErrors, () => setConfirmOpen(false)))();

  const selectedSupplier = suppliers.find((s) => s.supplierId === values.supplierId);
  const today = toLocalIsoDate(new Date().toISOString());
  // BE tạo PO thiếu `expectedAt` ⇒ hôm nay + lead time lớn nhất các dòng (danh mục), chưa có thì của NCC.
  const catalogLeadTime = planLeadTimeDays(values.lines);
  const leadTime = catalogLeadTime ?? selectedSupplier?.leadTimeDays ?? null;

  return {
    mode,
    form,
    lines,
    values,
    errors: formState.errors,
    isSubmitting,
    blocked,
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
    warehousesQuery,
    warehouses,
    keptWarehouse,
    inactiveWarehouse,
    warehousesFailed,
    selectedSupplier,
    today,
    catalog,
    suggestedDate: leadTime === null ? null : suggestExpectedDate(today, leadTime),
    suggestedFromCatalog: catalogLeadTime !== null,
    hasPrices: values.lines.some((l) => effectiveUnitPrice(l, values.currency) !== null),
    totals: calculateTotals(values.lines, values.currency),
  };
}

export type PoWizard = ReturnType<typeof usePoWizard>;
