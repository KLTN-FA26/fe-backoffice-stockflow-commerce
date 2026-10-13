"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { productionErrorMessage } from "@/features/production-order/errors";
import {
  cancelInputSchema,
  holdInputSchema,
  prepressInputSchema,
  stopInputSchema,
} from "@/features/production-order/input-schemas";
import {
  useCancelProduction,
  useHoldProduction,
  usePrepress,
  useStopProduction,
} from "@/features/production-order/mutations";
import { HOLD_REASONS } from "@/features/production-order/schemas";
import { HOLD_REASON_LABEL } from "@/features/production-order/selectors";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { FORM_INPUT_CLASS, FormField, fieldA11y } from "@/components/shared/FormField";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import type { z } from "zod";
import type { ProductionDetail } from "@/features/production-order/types";

export type StatusDialogKind = "prepress" | "hold" | "cancel" | "stop";
interface Props {
  order: ProductionDetail;
  onClose: () => void;
}

function PrepressForm({ order, onClose }: Props) {
  const [error, setError] = useState<string | null>(null);
  const mutation = usePrepress();
  const form = useForm<z.input<typeof prepressInputSchema>>({
    resolver: zodResolver(prepressInputSchema),
    defaultValues: { decision: "PASS", note: "" },
  });
  const decision = useWatch({ control: form.control, name: "decision" });
  const submit = form.handleSubmit((v) =>
    mutation.mutate(
      { id: order.summary.id, decision: v.decision, note: v.note },
      { onSuccess: onClose, onError: (e) => setError(productionErrorMessage(e)) },
    ),
  );
  return (
    <FormDialogBody
      title="Kiểm tra prepress"
      description="Đạt: hệ thống đối chiếu lại checksum file in với thiết kế đã khoá rồi chuyển sẵn sàng. Không đạt: treo lệnh (file bị từ chối) và báo Sales."
      submitLabel={decision === "PASS" ? "Xác nhận đạt" : "Xác nhận không đạt"}
      danger={decision === "FAIL"}
      canSubmit
      isPending={mutation.isPending}
      error={error}
      onCancel={onClose}
      onSubmit={() => void submit()}
    >
      <fieldset className="flex gap-4 text-[0.8125rem]">
        <legend className="sr-only">Kết quả</legend>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            value="PASS"
            {...form.register("decision")}
            className="accent-[var(--brand)]"
          />
          Đạt
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            value="FAIL"
            {...form.register("decision")}
            className="accent-[var(--brand)]"
          />
          Không đạt
        </label>
      </fieldset>
      <FormField
        id="prepress-note"
        label="Ghi chú"
        required={decision === "FAIL"}
        error={form.formState.errors.note?.message}
      >
        <Textarea
          {...form.register("note")}
          {...fieldA11y("prepress-note", form.formState.errors.note?.message)}
          rows={3}
        />
      </FormField>
    </FormDialogBody>
  );
}

function HoldForm({ order, onClose }: Props) {
  const [error, setError] = useState<string | null>(null);
  const mutation = useHoldProduction();
  const form = useForm<z.input<typeof holdInputSchema>>({
    resolver: zodResolver(holdInputSchema),
    defaultValues: { reason: "MACHINE_DOWN", note: "" },
  });
  const submit = form.handleSubmit((v) =>
    mutation.mutate(
      { id: order.summary.id, reason: v.reason, note: v.note },
      { onSuccess: onClose, onError: (e) => setError(productionErrorMessage(e)) },
    ),
  );
  return (
    <FormDialogBody
      title="Tạm dừng lệnh sản xuất"
      description="Lệnh giữ nguyên tiến độ; quản lý xưởng cho chạy tiếp về đúng bước trước khi dừng."
      submitLabel="Tạm dừng"
      canSubmit
      isPending={mutation.isPending}
      error={error}
      onCancel={onClose}
      onSubmit={() => void submit()}
    >
      <FormField id="hold-reason" label="Lý do" required>
        <select
          id="hold-reason"
          {...form.register("reason")}
          className={`${FORM_INPUT_CLASS} border px-2`}
        >
          {HOLD_REASONS.map((reason) => (
            <option key={reason} value={reason}>
              {HOLD_REASON_LABEL[reason]}
            </option>
          ))}
        </select>
      </FormField>
      <FormField id="hold-note" label="Ghi chú" error={form.formState.errors.note?.message}>
        <Textarea
          {...form.register("note")}
          {...fieldA11y("hold-note", form.formState.errors.note?.message)}
          rows={3}
        />
      </FormField>
    </FormDialogBody>
  );
}

function CancelForm({ order, onClose }: Props) {
  const [error, setError] = useState<string | null>(null);
  const mutation = useCancelProduction();
  const subcontracted = order.summary.mode === "SUBCONTRACTED";
  const form = useForm<z.input<typeof cancelInputSchema>>({
    resolver: zodResolver(cancelInputSchema),
    defaultValues: { reason: "", subcontractorFee: "", subcontractorFeeReason: "" },
  });
  const { errors } = form.formState;
  const submit = form.handleSubmit((v) =>
    mutation.mutate(
      {
        id: order.summary.id,
        reason: v.reason,
        ...(subcontracted && v.subcontractorFee
          ? {
              subcontractorFee: Number(v.subcontractorFee),
              subcontractorFeeReason: v.subcontractorFeeReason || undefined,
            }
          : {}),
      },
      { onSuccess: onClose, onError: (e) => setError(productionErrorMessage(e)) },
    ),
  );
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
      canSubmit
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
    </FormDialogBody>
  );
}

function StopForm({ order, onClose }: Props) {
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

const FORMS: Record<StatusDialogKind, (props: Props) => React.ReactNode> = {
  prepress: PrepressForm,
  hold: HoldForm,
  cancel: CancelForm,
  stop: StopForm,
};

export function StatusDialog({
  kind,
  order,
  onClose,
}: {
  kind: StatusDialogKind | null;
  order: ProductionDetail;
  onClose: () => void;
}) {
  const Form = kind ? FORMS[kind] : null;
  return (
    <FormDialog open={!!kind} onOpenChange={(open) => !open && onClose()}>
      {Form && <Form order={order} onClose={onClose} />}
    </FormDialog>
  );
}
