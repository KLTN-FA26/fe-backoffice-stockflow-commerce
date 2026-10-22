"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { productionErrorMessage } from "@/features/production-order/errors";
import { holdInputSchema, prepressInputSchema } from "@/features/production-order/input-schemas";
import { useHoldProduction, usePrepress } from "@/features/production-order/mutations";
import { HOLD_REASONS } from "@/features/production-order/schemas";
import { HOLD_REASON_LABEL } from "@/features/production-order/selectors";

import { FormDialogBody } from "@/components/shared/FormDialog";
import { FORM_INPUT_CLASS, FormField, fieldA11y } from "@/components/shared/FormField";
import { Textarea } from "@/components/ui/textarea";

import type { z } from "zod";
import type { ProductionDetail } from "@/features/production-order/types";

interface Props {
  order: ProductionDetail;
  onClose: () => void;
}

export function PrepressForm({ order, onClose }: Props) {
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

export function HoldForm({ order, onClose }: Props) {
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
