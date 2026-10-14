"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { SHIPPING_LIMITS, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { shippingErrorMessage } from "@/features/shipping/errors";
import { handoverInputSchema } from "@/features/shipping/input-schemas";
import { useHandoverLoad } from "@/features/shipping/mutations";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { FieldError, fieldClass } from "../primitives";

import type { HandoverFormInput, HandoverValues, Load } from "@/features/shipping/types";

const M = UI_LABELS.shipping.manifest;
const SERVER_FIELDS = ["carrierRepresentative", "note"] as const;

/**
 * Xác nhận bàn giao (docs 09 §4 bước 4–5): biên bản giấy đã in + hai bên ký → ghi tên đại diện hãng.
 * BE: chuyến DISPATCHED, kiện HANDED_OVER, đơn SHIPPED khi đủ kiện (BR-03). Không mã vận đơn.
 */
export function HandoverDialog({ load, onClose }: { load: Load; onClose: () => void }) {
  const handover = useHandoverLoad();
  // Cố định trong suốt lần mở dialog: bấm lại sau lỗi mạng gửi cùng key (BE chống bàn giao trùng)
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<HandoverFormInput, unknown, HandoverValues>({
    resolver: zodResolver(handoverInputSchema),
    mode: "onChange",
    defaultValues: { carrierRepresentative: "", note: "" },
  });
  const errors = form.formState.errors;
  // Sửa bất kỳ ô nào → lỗi máy chủ của lần gửi trước không còn đúng
  useEffect(
    () =>
      form.subscribe({
        formState: { values: true },
        callback: ({ type }) => {
          if (type === "change") setServerError(null);
        },
      }),
    [form],
  );

  const submit = form.handleSubmit((values) => {
    setServerError(null);
    handover.mutate(
      { loadId: load.loadId, version: load.version, values, idempotencyKey },
      {
        onSuccess: onClose,
        onError: (error) => {
          // Lỗi dữ liệu cũ đã có toast ở mutation (dialog có thể đóng ngay khi dữ liệu tải lại)
          setServerError(shippingErrorMessage(error));
          // @Valid của BE → gắn lỗi vào đúng ô (api-conventions §4.4)
          if (error instanceof ApiError) {
            for (const name of SERVER_FIELDS) {
              const message = error.fieldErrors?.[name];
              if (message) form.setError(name, { type: "server", message });
            }
          }
        },
      },
    );
  });

  return (
    // Đang gửi thì không cho đóng: đóng giữa chừng sẽ mất thông báo lỗi (vd OPTIMISTIC_LOCK)
    <FormDialog open onOpenChange={(next) => !next && !handover.isPending && onClose()}>
      <FormDialogBody
        title={`${UI_LABELS.shipping.action.handover} · ${load.number}`}
        description={M.handoverDescription}
        submitLabel={UI_LABELS.shipping.action.handover}
        canSubmit={form.formState.isValid}
        isPending={handover.isPending}
        error={serverError}
        onSubmit={() => void submit()}
        onCancel={() => !handover.isPending && onClose()}
      >
        <div>
          <Label
            htmlFor="handover-rep"
            className="text-ink-secondary mb-1 block text-xs font-medium"
          >
            {M.carrierRepresentative} <span className="text-danger">*</span>
          </Label>
          <Input
            id="handover-rep"
            autoFocus
            maxLength={SHIPPING_LIMITS.carrierRepresentativeMax}
            aria-invalid={errors.carrierRepresentative ? true : undefined}
            aria-describedby={errors.carrierRepresentative ? "handover-rep-error" : undefined}
            className={fieldClass(!!errors.carrierRepresentative)}
            {...form.register("carrierRepresentative")}
          />
          <FieldError id="handover-rep-error">{errors.carrierRepresentative?.message}</FieldError>
        </div>
        <div>
          <Label
            htmlFor="handover-note"
            className="text-ink-secondary mb-1 block text-xs font-medium"
          >
            {M.note}
          </Label>
          <Textarea
            id="handover-note"
            rows={2}
            maxLength={SHIPPING_LIMITS.noteMax}
            aria-invalid={errors.note ? true : undefined}
            aria-describedby={errors.note ? "handover-note-error" : undefined}
            className="border-border-default bg-bg-surface rounded-[var(--r-sm)] text-[0.8125rem]"
            {...form.register("note")}
          />
          <FieldError id="handover-note-error">{errors.note?.message}</FieldError>
        </div>
        <Controller
          control={form.control}
          name="signed"
          render={({ field }) => (
            <label htmlFor="handover-signed" className="flex items-center gap-2 text-[0.8125rem]">
              <Checkbox
                id="handover-signed"
                aria-describedby="handover-signed-hint"
                checked={field.value === true}
                onCheckedChange={(checked) => field.onChange(checked === true ? true : undefined)}
              />
              <span className="text-ink-primary">{M.signedConfirm}</span>
            </label>
          )}
        />
        {/* Nút xác nhận khoá tới khi tick — nói rõ vì sao */}
        <p id="handover-signed-hint" className="text-ink-tertiary -mt-1 pl-6 text-xs">
          {M.signedHint}
        </p>
      </FormDialogBody>
    </FormDialog>
  );
}
