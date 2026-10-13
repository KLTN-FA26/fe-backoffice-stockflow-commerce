"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { ADMIN_ROUTES, SUPPLIER_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth/components/Can";
import { formatNumber } from "@/lib/format/number";
import { useSupplierOptions } from "@/lib/references/supplier-options";
import { productionErrorMessage } from "@/features/production-order/errors";
import { splitInputSchema } from "@/features/production-order/input-schemas";
import { useSplitSubcontract } from "@/features/production-order/mutations";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FORM_INPUT_CLASS, FormField, fieldA11y } from "@/components/shared/FormField";
import { Input } from "@/components/ui/input";

import type { z } from "zod";
import type { ProductionDetail } from "@/features/production-order/types";

const METHOD_LABEL = {
  SUPPLIED_BLANKS: "Gửi phôi cho nhà gia công in",
  FULL_SERVICE: "Nhà gia công tự lo phôi",
} as const;

function SplitForm({ order, onClose }: { order: ProductionDetail; onClose: () => void }) {
  const router = useRouter();
  const canListSuppliers = useCan(SUPPLIER_PERMISSIONS.read);
  const suppliers = useSupplierOptions(canListSuppliers);
  const [error, setError] = useState<string | null>(null);
  const split = useSplitSubcontract();
  const unissued = order.summary.plannedQuantity - order.issuedQuantity;
  const form = useForm<z.input<typeof splitInputSchema>>({
    resolver: zodResolver(splitInputSchema),
    defaultValues: {
      quantity: "",
      subcontractorId: "",
      method: "SUPPLIED_BLANKS",
      unitPrice: "",
      dueDate: order.summary.dueDate ?? "",
    },
  });
  const { errors } = form.formState;
  const submit = form.handleSubmit((v) =>
    split.mutate(
      {
        id: order.summary.id,
        quantity: Number(v.quantity),
        subcontractorId: v.subcontractorId,
        method: v.method,
        unitPrice: Number(v.unitPrice),
        ...(v.dueDate ? { dueDate: v.dueDate } : {}),
      },
      {
        onSuccess: (child) => {
          onClose();
          // Tách một phần → BE trả LSX CON; gửi trọn LSX → chính LSX này đổi sang gia công.
          if (child.summary.id !== order.summary.id)
            router.push(ADMIN_ROUTES.productionOrders.detail(child.summary.id));
        },
        onError: (failure) => setError(productionErrorMessage(failure)),
      },
    ),
  );

  return (
    <FormDialogBody
      title="Tách gia công ngoài"
      description={`Phần chưa xuất phôi: ${formatNumber(unissued)} cái. Tách một phần → tạo LSX con gia công kèm đơn đặt gia công nháp; tách toàn bộ khi chưa xuất / in → chuyển cả LSX sang gia công. Chỉ gửi đi sau khi đơn đặt gia công được duyệt.`}
      submitLabel="Tách gia công"
      canSubmit
      isPending={split.isPending}
      error={error}
      onCancel={onClose}
      onSubmit={() => void submit()}
    >
      <FormField
        id="split-qty"
        label="Số lượng gia công (cái)"
        required
        error={errors.quantity?.message}
      >
        <Input
          {...form.register("quantity")}
          {...fieldA11y("split-qty", errors.quantity?.message)}
          inputMode="numeric"
          autoFocus
          className={`${FORM_INPUT_CLASS} text-right tabular-nums`}
        />
      </FormField>
      <FormField
        id="split-supplier"
        label="Nhà gia công"
        required
        error={errors.subcontractorId?.message}
        hint={
          canListSuppliers
            ? "Chỉ NCC được đánh dấu là nhà gia công in mới được chấp nhận."
            : "Chưa có quyền xem danh sách NCC — nhập mã NCC (UUID)."
        }
      >
        {canListSuppliers ? (
          <select
            id="split-supplier"
            {...form.register("subcontractorId")}
            className={`${FORM_INPUT_CLASS} border px-2`}
          >
            <option value="">— Chọn nhà gia công —</option>
            {(suppliers.data ?? []).map((supplier) => (
              <option key={supplier.supplierId} value={supplier.supplierId}>
                {supplier.code} — {supplier.name}
              </option>
            ))}
          </select>
        ) : (
          <Input
            {...form.register("subcontractorId")}
            {...fieldA11y("split-supplier", errors.subcontractorId?.message, true)}
            className={`${FORM_INPUT_CLASS} font-[family-name:var(--font-mono)]`}
          />
        )}
      </FormField>
      <FormField id="split-method" label="Hình thức" required>
        <select
          id="split-method"
          {...form.register("method")}
          className={`${FORM_INPUT_CLASS} border px-2`}
        >
          {(Object.keys(METHOD_LABEL) as (keyof typeof METHOD_LABEL)[]).map((method) => (
            <option key={method} value={method}>
              {METHOD_LABEL[method]}
            </option>
          ))}
        </select>
      </FormField>
      <FormField
        id="split-price"
        label="Đơn giá gia công (VND / cái)"
        required
        error={errors.unitPrice?.message}
      >
        <Input
          {...form.register("unitPrice")}
          {...fieldA11y("split-price", errors.unitPrice?.message)}
          inputMode="decimal"
          className={`${FORM_INPUT_CLASS} text-right tabular-nums`}
        />
      </FormField>
      <FormField id="split-due" label="Hạn trả hàng" error={errors.dueDate?.message}>
        <Input
          type="date"
          {...form.register("dueDate")}
          {...fieldA11y("split-due", errors.dueDate?.message)}
          className={FORM_INPUT_CLASS}
        />
      </FormField>
    </FormDialogBody>
  );
}

export function SplitDialog({
  order,
  open,
  onOpenChange,
}: {
  order: ProductionDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange}>
      {open && <SplitForm order={order} onClose={() => onOpenChange(false)} />}
    </FormDialog>
  );
}
