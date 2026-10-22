"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { ADMIN_ROUTES } from "@/constants";

import { formatNumber } from "@/lib/format/number";

import { productionErrorMessage } from "@/features/production-order/errors";
import { quantityReasonInputSchema } from "@/features/production-order/input-schemas";
import { useSupplementSubcontract, useTakeInHouse } from "@/features/production-order/mutations";

import { LocationField } from "@/components/backoffice/LocationField";
import { FormDialogBody } from "@/components/shared/FormDialog";
import { FORM_INPUT_CLASS, FormField, fieldA11y } from "@/components/shared/FormField";
import { Input } from "@/components/ui/input";

import { NUM } from "./SubcontractRecoveryForms";

import type { z } from "zod";
import type { ProductionDetail } from "@/features/production-order/types";

export function QuantityReasonForm({
  order,
  kind,
  onClose,
}: {
  order: ProductionDetail;
  kind: "inHouse" | "supplement";
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const inHouse = useTakeInHouse();
  const supplement = useSupplementSubcontract();
  const pending = inHouse.isPending || supplement.isPending;
  const owed = Math.max(0, order.summary.plannedQuantity - order.summary.goodQuantity);
  const form = useForm<z.input<typeof quantityReasonInputSchema>>({
    resolver: zodResolver(quantityReasonInputSchema),
    defaultValues: {
      quantity: kind === "inHouse" ? String(owed) : "",
      reason: "",
      packingLocation: "",
    },
  });
  const { errors } = form.formState;
  const onError = (e: unknown) => setError(productionErrorMessage(e));
  const submit = form.handleSubmit((v) => {
    if (kind === "inHouse")
      inHouse.mutate(
        {
          id: order.summary.id,
          quantity: Number(v.quantity),
          reason: v.reason,
          ...(v.packingLocation ? { packingLocation: v.packingLocation } : {}),
        },
        {
          onSuccess: (created) => {
            onClose();
            router.push(ADMIN_ROUTES.productionOrders.detail(created.summary.id));
          },
          onError,
        },
      );
    else
      supplement.mutate(
        { id: order.summary.id, quantity: Number(v.quantity), reason: v.reason },
        { onSuccess: onClose, onError },
      );
  });
  return (
    <FormDialogBody
      title={kind === "inHouse" ? "Chuyển phần còn lại về xưởng" : "Đặt thêm cho nhà gia công"}
      description={
        kind === "inHouse"
          ? `Còn nợ ${formatNumber(owed)} cái. Tạo LSX mới tại xưởng cho phần này; hàng đã QC đạt vẫn giữ cho đơn (QA2).`
          : "Đơn đặt gia công nháp được tăng số lượng; đơn đã duyệt tạo yêu cầu điều chỉnh chờ người khác duyệt."
      }
      submitLabel={kind === "inHouse" ? "Tạo LSX tại xưởng" : "Đặt thêm"}
      canSubmit
      isPending={pending}
      error={error}
      onCancel={onClose}
      onSubmit={() => void submit()}
    >
      <FormField id="qr-qty" label="Số lượng (cái)" required error={errors.quantity?.message}>
        <Input
          {...form.register("quantity")}
          {...fieldA11y("qr-qty", errors.quantity?.message)}
          inputMode="numeric"
          className={NUM}
          autoFocus
        />
      </FormField>
      <FormField id="qr-reason" label="Lý do" required error={errors.reason?.message}>
        <Input
          {...form.register("reason")}
          {...fieldA11y("qr-reason", errors.reason?.message)}
          className={FORM_INPUT_CLASS}
        />
      </FormField>
      {kind === "inHouse" && (
        <Controller
          control={form.control}
          name="packingLocation"
          render={({ field }) => (
            <LocationField
              id="qr-packing"
              label="Khu đóng gói (nếu hoàn tất luôn)"
              warehouseId={order.summary.warehouseId}
              areaType="PACKING"
              value={field.value}
              onChange={field.onChange}
              emptyHint="Để trống nếu kho chỉ có một khu đóng gói."
            />
          )}
        />
      )}
    </FormDialogBody>
  );
}
