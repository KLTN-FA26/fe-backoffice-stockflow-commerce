"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ADMIN_ROUTES, PAGE_SIZE } from "@/constants";
import { createPoSchema, useCreatePo, usePoSuppliers } from "@/features/purchase-order";
import { useSkus } from "@/features/product";
import { toast } from "@/components/shared/Toast";

import { calculateTotals, createEmptyLine, validateForm } from "./helpers";
import { createInitialForm } from "./types";

import type { ApiError } from "@/lib/api/error";
import type { CreatePoInput } from "@/features/purchase-order";
import type { FormState, PoLineDraft, StepKey } from "./types";

function toCreateInput(form: FormState): CreatePoInput {
  return {
    supplierId: form.supplierId,
    currency: form.currency,
    expectedAt: form.expectedDate || null,
    lines: form.lines.map((l) => ({
      sku: l.skuId,
      description: l.description || null,
      quantityOrdered: Number(l.orderedQty),
      unitPrice: Number(l.unitPrice),
    })),
  };
}

export function useCreateForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(createInitialForm);
  const [currentStep, setCurrentStep] = useState<StepKey>("info");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const createPo = useCreatePo();
  // FE-only master data (BE has no /suppliers or /skus yet — see api.ts).
  const suppliersQuery = usePoSuppliers({});
  const skusQuery = useSkus({ page: 1, pageSize: PAGE_SIZE.masterData });

  const suppliers = useMemo(() => suppliersQuery.data?.items ?? [], [suppliersQuery.data]);
  const skus = useMemo(() => skusQuery.data?.items ?? [], [skusQuery.data]);
  const activeSuppliers = useMemo(() => suppliers.filter((s) => s.active), [suppliers]);
  const activeSkus = useMemo(() => skus.filter((s) => s.status === "Active"), [skus]);
  const selectedSupplier = suppliers.find((s) => s.supplierId === form.supplierId);
  const totals = useMemo(() => calculateTotals(form.lines), [form.lines]);
  const validationIssues = useMemo(() => validateForm(form), [form]);
  const issuesByStep = useMemo(() => {
    const m = new Map<StepKey, string[]>();
    for (const i of validationIssues) m.set(i.step, [...(m.get(i.step) ?? []), i.message]);
    return m;
  }, [validationIssues]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((p) => ({ ...p, [key]: value }));
  const updateLine = (lineId: string, patch: Partial<PoLineDraft>) =>
    setForm((p) => ({
      ...p,
      lines: p.lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)),
    }));
  const handleSupplierChange = (supplierId: string) => {
    const sup = suppliers.find((s) => s.supplierId === supplierId);
    setForm((p) => ({
      ...p,
      supplierId,
      // BR-07 (docs 02): PO currency follows the supplier's currency.
      currency: sup?.currency ?? p.currency,
      paymentTerms: sup?.paymentTerms ?? "",
    }));
  };
  const handleSkuChange = (lineId: string, skuId: string) => {
    const sku = skus.find((s) => s.skuId === skuId);
    updateLine(lineId, { skuId, unitPrice: sku ? String(sku.cost) : "", uom: sku?.uom ?? "" });
  };
  const addLine = () => update("lines", [...form.lines, createEmptyLine()]);
  const removeLine = (id: string) =>
    update(
      "lines",
      form.lines.filter((l) => l.id !== id),
    );

  const handleSubmitAttempt = () => {
    setSubmitAttempted(true);
    const firstIssue = validationIssues[0];
    if (firstIssue) {
      toast.error("Chưa thể tạo PO", firstIssue.message);
      return;
    }
    setConfirmOpen(true);
  };

  const handleConfirmSubmit = () => {
    setConfirmOpen(false);
    // Input schema = last guard before the wire (same rules as BE CreatePurchaseOrderRequest).
    const parsed = createPoSchema.safeParse(toCreateInput(form));
    if (!parsed.success) {
      toast.error("Dữ liệu chưa hợp lệ", parsed.error.issues[0]?.message ?? "");
      return;
    }
    createPo.mutate(parsed.data, {
      onSuccess: (created) => {
        if (created.possibleDuplicate)
          toast.warning(
            "Có thể trùng lặp",
            `PO ${created.poNumber} có cùng NCC + SKU với đơn cùng ngày giao (BR-PO-003).`,
          );
        else toast.success("Đã tạo PO", `PO ${created.poNumber} đã được tạo ở trạng thái DRAFT.`);
        const query = created.possibleDuplicate ? "?duplicate=1" : "";
        router.push(`${ADMIN_ROUTES.purchaseOrders.detail(created.poId)}${query}`);
      },
      onError: (e: ApiError) => {
        const [field, message] = Object.entries(e.fieldErrors ?? {})[0] ?? [];
        if (field) toast.error("Dữ liệu chưa hợp lệ", `${field}: ${message}`);
        else toast.error("Không thể tạo PO", e.message);
      },
    });
  };

  return {
    form,
    update,
    updateLine,
    handleSupplierChange,
    handleSkuChange,
    addLine,
    removeLine,
    currentStep,
    setCurrentStep,
    submitAttempted,
    setSubmitAttempted,
    confirmOpen,
    setConfirmOpen,
    isSubmitting: createPo.isPending,
    isLoading: suppliersQuery.isLoading || skusQuery.isLoading,
    masterDataError: suppliersQuery.isError || skusQuery.isError,
    activeSuppliers,
    activeSkus,
    selectedSupplier,
    totals,
    validationIssues,
    issuesByStep,
    handleSubmitAttempt,
    handleConfirmSubmit,
  };
}
