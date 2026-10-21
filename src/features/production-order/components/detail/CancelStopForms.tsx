"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { productionErrorMessage } from "@/features/production-order/errors";
import { cancelInputSchema, stopInputSchema } from "@/features/production-order/input-schemas";
import { useCancelProduction, useStopProduction } from "@/features/production-order/mutations";
import { usePackingLocations } from "@/features/production-order/queries";

import { FormDialogBody } from "@/components/shared/FormDialog";
import { FORM_INPUT_CLASS, FormField, fieldA11y } from "@/components/shared/FormField";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import type { z } from "zod";
import type { ProductionDetail } from "@/features/production-order/types";

interface Props {
  order: ProductionDetail;
  onClose: () => void;
}

export function CancelForm({ order, onClose }: Props) {
  const [error, setError] = useState<string | null>(null);
  const mutation = useCancelProduction();
  const subcontracted = order.summary.mode === "SUBCONTRACTED";
  const needsPacking = subcontracted && order.summary.type === "ORDER" && order.summary.goodQuantity > 0;
  const packing = usePackingLocations(order.summary.id, needsPacking);
  const form = useForm<z.input<typeof cancelInputSchema>>({
    resolver: zodResolver(cancelInputSchema),
    defaultValues: { reason: "", subcontractorFee: "", subcontractorFeeReason: "", packingLocation: "" },
  });
  const { errors } = form.formState;
  const submit = form.handleSubmit((v) => {
    if (needsPacking && (packing.data?.length ?? 0) > 1 && !v.packingLocation) {
      form.setError("packingLocation", { message: "Chọn khu đóng gói nhận hàng" });
      return;
    }
    mutation.mutate(
      {
        id: order.summary.id,
        reason: v.reason,
        ...(v.packingLocation ? { packingLocation: v.packingLocation } : {}),
        ...(subcontracted && v.subcontractorFee
          ? {
              subcontractorFee: Number(v.subcontractorFee),
              subcontractorFeeReason: v.subcontractorFeeReason || undefined,
            }
          : {}),
      },
      { onSuccess: onClose, onError: (e) => setError(productionErrorMessage(e)) },
    );
  });
  return (
    <FormDialogBody
      title="Huỷ lệnh sản xuất"
      description={
        subcontracted
          ? "Phôi phải được đối soát xong. Phần còn nợ của đơn chuyển sang LSX tại xưởng; phí huỷ với nhà gia công là số đã thoả thuận, hệ thống không tự tính hay tự chi (QA2)."
          : "Chỉ huỷ được trước khi in; phôi đã xuất được trả lại kho."
      }
      submitLabel="Huỷ lệnh"
      danger
      canSubmit={!needsPacking || (!packing.isPending && !packing.isError && !!packing.data?.length)}
      isPending={mutation.isPending}
      error={error}
      onCancel={onClose}
      onSubmit={() => void submit()}
    >
      <FormField id="cancel-reason" label="Lý do huỷ" required error={errors.reason?.message}>
        <Textarea
          {...form.register("reason")}
          {...fieldA11y("cancel-reason", errors.reason?.message)}
          rows={3}
          autoFocus
        />
      </FormField>
      {subcontracted && (
        <>
          <FormField
            id="cancel-fee"
            label="Phí huỷ đã thoả thuận với nhà gia công"
            error={errors.subcontractorFee?.message}
          >
            <Input
              {...form.register("subcontractorFee")}
              {...fieldA11y("cancel-fee", errors.subcontractorFee?.message)}
              inputMode="decimal"
              className={`${FORM_INPUT_CLASS} text-right tabular-nums`}
            />
          </FormField>
          <FormField
            id="cancel-fee-reason"
            label="Lý do / căn cứ phí"
            error={errors.subcontractorFeeReason?.message}
          >
            <Input
              {...form.register("subcontractorFeeReason")}
              {...fieldA11y("cancel-fee-reason", errors.subcontractorFeeReason?.message)}
              className={FORM_INPUT_CLASS}
            />
          </FormField>
        </>
      )}
      {needsPacking && (
        <FormField
          id="cancel-packing"
          label="Khu đóng gói nhận hàng tốt"
          error={errors.packingLocation?.message}
          hint={packing.isError ? productionErrorMessage(packing.error) : undefined}
        >
          <select
            {...form.register("packingLocation")}
            {...fieldA11y("cancel-packing", errors.packingLocation?.message)}
            disabled={!packing.data || packing.data.length < 2}
            className={`${FORM_INPUT_CLASS} border px-2`}
          >
            <option value="">
              {packing.data?.length === 1 ? `Mặc định: ${packing.data[0]}` : "— Chọn khu đóng gói —"}
            </option>
            {packing.data?.length && packing.data.length > 1
              ? packing.data.map((code) => <option key={code} value={code}>{code}</option>)
              : null}
          </select>
        </FormField>
      )}
    </FormDialogBody>
  );
}

export function StopForm({ order, onClose }: Props) {
  const [error, setError] = useState<string | null>(null);
  const mutation = useStopProduction();
  const form = useForm<z.input<typeof stopInputSchema>>({
    resolver: zodResolver(stopInputSchema),
    defaultValues: { printed: "0", reason: "" },
  });
  const { errors } = form.formState;
  const submit = form.handleSubmit((v) =>
    mutation.mutate(
      { id: order.summary.id, printed: Number(v.printed), scrap: [], reason: v.reason },
      { onSuccess: onClose, onError: (e) => setError(productionErrorMessage(e)) },
    ),
  );
  return (
    <FormDialogBody
      title="Dừng lệnh đang in / QC"
      description="Ghi nhận số đã in thực tế chưa báo; hàng in tốt bị xuất huỷ, phôi chưa in trả về kho (Q2: phần chưa in dừng lại)."
      submitLabel="Dừng lệnh"
      danger
      canSubmit
      isPending={mutation.isPending}
      error={error}
      onCancel={onClose}
      onSubmit={() => void submit()}
    >
      <FormField id="stop-printed" label="Số đã in chưa ghi (cái)" error={errors.printed?.message}>
        <Input
          {...form.register("printed")}
          {...fieldA11y("stop-printed", errors.printed?.message)}
          inputMode="numeric"
          className={`${FORM_INPUT_CLASS} text-right tabular-nums`}
        />
      </FormField>
      <FormField id="stop-reason" label="Lý do dừng" required error={errors.reason?.message}>
        <Textarea
          {...form.register("reason")}
          {...fieldA11y("stop-reason", errors.reason?.message)}
          rows={3}
        />
      </FormField>
    </FormDialogBody>
  );
}
