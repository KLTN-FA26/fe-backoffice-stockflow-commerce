"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { PAGE_SIZE } from "@/constants";
import { useCreatePo, usePoSuppliers, usePurchaseOrders } from "@/features/purchase-order";
import { useSkus } from "@/features/product";
import { toast } from "@/components/shared/Toast";
import { ADMIN_ROUTES } from "@/constants";

import { calculateTotals, createEmptyLine, validateForm } from "./helpers";
import { INITIAL_FORM, type FormState, type PoLineDraft, type StepKey } from "./types";

export function useCreateForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [currentStep, setCurrentStep] = useState<StepKey>("info");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const createPo = useCreatePo();
  const suppliersQuery = usePoSuppliers({});
  const skusQuery = useSkus({ page: 1, pageSize: PAGE_SIZE.masterData });
  const posQuery = usePurchaseOrders({ page: 1, pageSize: PAGE_SIZE.masterData });

  const suppliers = useMemo(() => suppliersQuery.data?.items ?? [], [suppliersQuery.data]);
  const skus = useMemo(() => skusQuery.data?.items ?? [], [skusQuery.data]);
  const purchaseOrders = useMemo(() => posQuery.data?.items ?? [], [posQuery.data]);
  const isLoading = suppliersQuery.isLoading || skusQuery.isLoading || posQuery.isLoading;

  const activeSuppliers = useMemo(() => suppliers.filter((s) => s.active), [suppliers]);
  const activeSkus = useMemo(() => skus.filter((s) => s.status === "Active"), [skus]);
  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.supplierId === form.supplierId),
    [form.supplierId, suppliers],
  );
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
      currency: sup?.currency ?? "VND",
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
    if (validationIssues.length > 0) {
      const firstIssue = validationIssues[0];
      if (firstIssue) toast.error("Chưa thể tạo PO", firstIssue.message);
      return false;
    }
    setConfirmOpen(true);
    return true;
  };
  const handleConfirmSubmit = (onDup: (dup: boolean) => void) => {
    setConfirmOpen(false);
    createPo.mutate(
      {
        supplierId: form.supplierId,
        currency: form.currency || selectedSupplier?.currency || "VND",
        expectedAt: form.expectedDate || null,
        expectedDate: form.expectedDate || undefined,
        lines: form.lines.map((l) => ({
          sku: l.skuId,
          description: l.description || null,
          quantityOrdered: Number(l.orderedQty) || 0,
          unitPrice: Number(l.unitPrice) || 0,
        })),
      } as never,
      {
        onSuccess: (created: { poId: string; poNumber: string; possibleDuplicate?: boolean }) => {
          const dup = Boolean((created as { possibleDuplicate?: boolean }).possibleDuplicate);
          if (dup)
            toast.warning(
              "Có thể trùng lặp",
              `PO ${created.poNumber} có cùng NCC + SKU với đơn cùng ngày giao (BR-PO-003).`,
            );
          else toast.success("Đã tạo PO", `PO ${created.poNumber} đã được tạo ở trạng thái DRAFT.`);
          router.push(
            `${ADMIN_ROUTES.purchaseOrders.detail(created.poId)}${dup ? "?duplicate=1" : ""}`,
          );
          onDup(dup);
        },
        onError: (err: unknown) => {
          const e = err as { fieldErrors?: Record<string, string>; message?: string };
          if (e.fieldErrors && Object.keys(e.fieldErrors).length) {
            const firstEntry = Object.entries(e.fieldErrors)[0];
            if (!firstEntry) return;
            const [k, v] = firstEntry;
            toast.error("Dữ liệu chưa hợp lệ", `${k}: ${v}`);
            return;
          }
          toast.error("Không thể tạo PO", e.message ?? "Vui lòng thử lại.");
        },
      },
    );
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
    suppliers,
    skus,
    purchaseOrders,
    isLoading,
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
