"use client";

import { Controller } from "react-hook-form";

import { CARRIER_STATUSES, SHIPPING_LIMITS, UI_LABELS } from "@/constants";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { FieldError, MONO, fieldClass } from "../primitives";
import { CarrierConnectionFields } from "./CarrierConnectionFields";
import { useCarrierForm } from "./useCarrierForm";

import type { Carrier } from "@/features/shipping/types";

const C = UI_LABELS.shipping.waybill.carriers;
const FORM = C.form;
const TRIGGER =
  "border-border-default bg-bg-surface h-8 w-full rounded-[var(--r-sm)] text-[0.8125rem]";
type TextField = "code" | "name" | "contactName" | "contactPhone";

/**
 * Thêm / sửa hãng vận chuyển (BE `POST` / `PUT /fulfillment/carriers`, docs 09 §4.1): mã, tên, liên hệ, trạng thái, kiểu
 * kết nối (không có webhook / webhook theo chuyến + khoá bí mật; khoá chỉ đi vào, không hiện lại). Hãng đặt xe qua API: chỉ sửa
 * thông tin chung, cấu hình kết nối giữ nguyên (BE: bỏ `connection` = giữ). Lỗi 409 CARRIER_CODE_EXISTS / OPTIMISTIC_LOCK
 * và lỗi từng ô của BE hiện inline.
 */
export function CarrierFormDialog({
  carrier,
  onClose,
}: {
  /** `null` = thêm hãng mới. */
  carrier: Carrier | null;
  onClose: () => void;
}) {
  const { form, submit, serverError, pending, locked, secretSaved } = useCarrierForm(
    carrier,
    onClose,
  );
  const errors = form.formState.errors;
  const text = (
    name: TextField,
    label: string,
    max: number,
    opts: { required?: boolean; mono?: boolean; hint?: string; autoFocus?: boolean } = {},
  ) => (
    <div>
      <Label
        htmlFor={`carrier-${name}`}
        className="text-ink-secondary mb-1 block text-xs font-medium"
      >
        {label} {opts.required && <span className="text-danger">*</span>}
      </Label>
      <Input
        id={`carrier-${name}`}
        autoFocus={opts.autoFocus}
        maxLength={max}
        autoComplete="off"
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={errors[name] ? `carrier-${name}-error` : undefined}
        className={`${fieldClass(!!errors[name])} ${opts.mono ? MONO : ""}`}
        {...form.register(name)}
      />
      {opts.hint && <p className="text-ink-tertiary mt-1 text-xs">{opts.hint}</p>}
      <FieldError id={`carrier-${name}-error`}>{errors[name]?.message}</FieldError>
    </div>
  );

  return (
    <FormDialog open onOpenChange={(next) => !next && !pending && onClose()}>
      <FormDialogBody
        title={carrier ? FORM.editTitle : FORM.createTitle}
        description={FORM.description}
        submitLabel={carrier ? FORM.save : FORM.create}
        canSubmit={form.formState.isValid}
        isPending={pending}
        error={serverError}
        onSubmit={submit}
        onCancel={() => !pending && onClose()}
      >
        {text("code", FORM.code, SHIPPING_LIMITS.carrierCodeMax, {
          required: true,
          mono: true,
          hint: FORM.codeHint,
          autoFocus: !carrier,
        })}
        {text("name", FORM.name, SHIPPING_LIMITS.carrierNameMax, { required: true })}
        {text("contactName", FORM.contactName, SHIPPING_LIMITS.carrierContactNameMax)}
        {text("contactPhone", FORM.contactPhone, SHIPPING_LIMITS.carrierContactPhoneMax, {
          mono: true,
        })}
        <div>
          <Label
            htmlFor="carrier-status"
            className="text-ink-secondary mb-1 block text-xs font-medium"
          >
            {FORM.status}
          </Label>
          <Controller
            control={form.control}
            name="status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="carrier-status" className={TRIGGER}>
                  <SelectValue />
                </SelectTrigger>
                <TitledSelectContent title={FORM.status}>
                  {CARRIER_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {C.status[status]}
                    </SelectItem>
                  ))}
                </TitledSelectContent>
              </Select>
            )}
          />
        </div>
        <CarrierConnectionFields form={form} locked={locked} secretSaved={secretSaved} />
      </FormDialogBody>
    </FormDialog>
  );
}
