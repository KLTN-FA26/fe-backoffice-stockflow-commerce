"use client";

import { useState } from "react";
import { Controller, useWatch } from "react-hook-form";

import { SHIPPING_LIMITS, UI_LABELS } from "@/constants";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { FieldError, MONO, fieldClass } from "../primitives";

import type { UseFormReturn } from "react-hook-form";
import type { HandoverFormInput, HandoverValues, Load } from "@/features/shipping/types";

const H = UI_LABELS.shipping.handover;
export const HANDOVER_SERVER_FIELDS = [
  "driverName",
  "carrierRepresentative",
  "vehiclePlate",
  "driverPhone",
  "signatureRef",
  "note",
] as const;

type TextField = (typeof HANDOVER_SERVER_FIELDS)[number];

/**
 * Các ô của biên bản bàn giao. Bắt buộc (hiện sẵn): tên tài xế (nếu chuyến chưa có), người ký bên hãng kèm hộp kiểm
 * "Người ký là tài xế", biển số (nếu chưa có), xác nhận đã ký. Không bắt buộc (SĐT, mã biên bản giấy, ghi chú) gập sau
 * một nút — hộp thoại không còn sáu ô trống (S18-2). Dòng "Còn thiếu" nói ô nào còn khoá nút xác nhận (R7, FE#292 U46).
 */
export function HandoverFields({
  form,
  load,
  signerIsDriver,
}: {
  form: UseFormReturn<HandoverFormInput, unknown, HandoverValues>;
  load: Load;
  signerIsDriver: { checked: boolean; onChange: (checked: boolean) => void };
}) {
  const errors = form.formState.errors;
  // SĐT tài xế đã về từ hãng thì mở sẵn khối thông tin thêm để người ký thấy
  const [moreOpen, setMoreOpen] = useState(!!load.driverPhone);
  const [driverName, representative, vehiclePlate, signed] = useWatch({
    control: form.control,
    name: ["driverName", "carrierRepresentative", "vehiclePlate", "signed"],
  });
  // Lỗi của BE ở một ô đang gập (SĐT, mã biên bản, ghi chú) thì mở khối ra để người ký thấy
  const showMore = moreOpen || !!(errors.driverPhone || errors.signatureRef || errors.note);
  const missing: string[] = [];
  if (!load.driverName && !driverName?.trim()) missing.push(H.missing.driverName);
  if (!representative?.trim()) missing.push(H.missing.representative);
  if (!load.vehiclePlate && !vehiclePlate?.trim()) missing.push(H.missing.vehiclePlate);
  if (signed !== true) missing.push(H.missing.signed);
  const text = (
    name: Exclude<TextField, "note">,
    label: string,
    max: number,
    opts: { required?: boolean; mono?: boolean; autoFocus?: boolean } = {},
  ) => (
    <div>
      <Label
        htmlFor={`handover-${name}`}
        className="text-ink-secondary mb-1 block text-xs font-medium"
      >
        {label} {opts.required && <span className="text-danger">*</span>}
      </Label>
      <Input
        id={`handover-${name}`}
        autoFocus={opts.autoFocus}
        maxLength={max}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={errors[name] ? `handover-${name}-error` : undefined}
        className={`${fieldClass(!!errors[name])} ${opts.mono ? MONO : ""}`}
        {...form.register(name)}
      />
      <FieldError id={`handover-${name}-error`}>{errors[name]?.message}</FieldError>
    </div>
  );

  return (
    <>
      {!load.driverName && (
        <>
          {text("driverName", H.driverName, SHIPPING_LIMITS.driverNameMax, { required: true })}
          <p className="text-ink-tertiary -mt-2 text-xs">{H.driverNameHint}</p>
        </>
      )}
      {text("carrierRepresentative", H.representative, SHIPPING_LIMITS.carrierRepresentativeMax, {
        required: true,
        autoFocus: true,
      })}
      {/* Docs 09 §4.2 bước 8 (PR docs #55): chỉ khi tick, tên tài xế mới được sao chép sang ô người ký (sửa được) */}
      <label
        htmlFor="handover-signer-is-driver"
        className="-mt-1 flex items-center gap-2 text-[0.8125rem]"
      >
        <Checkbox
          id="handover-signer-is-driver"
          checked={signerIsDriver.checked}
          onCheckedChange={(checked) => signerIsDriver.onChange(checked === true)}
        />
        <span className="text-ink-primary">{H.signerIsDriver}</span>
      </label>
      {text("vehiclePlate", H.vehiclePlate, SHIPPING_LIMITS.vehiclePlateMax, {
        required: !load.vehiclePlate,
        mono: true,
      })}
      {showMore ? (
        <>
          {text("driverPhone", H.driverPhone, SHIPPING_LIMITS.driverPhoneMax, { mono: true })}
          {text("signatureRef", H.signatureRef, SHIPPING_LIMITS.signatureRefMax)}
          <p className="text-ink-tertiary -mt-2 text-xs">{H.signatureRefHint}</p>
          <div>
            <Label
              htmlFor="handover-note"
              className="text-ink-secondary mb-1 block text-xs font-medium"
            >
              {H.note}
            </Label>
            <Textarea
              id="handover-note"
              rows={2}
              maxLength={SHIPPING_LIMITS.noteMax}
              aria-invalid={errors.note ? true : undefined}
              className="border-border-default bg-bg-surface rounded-[var(--r-sm)] text-[0.8125rem]"
              {...form.register("note")}
            />
            <FieldError>{errors.note?.message}</FieldError>
          </div>
        </>
      ) : (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto justify-start p-0 text-[0.8125rem]"
          onClick={() => setMoreOpen(true)}
        >
          {H.moreOpen}
        </Button>
      )}
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
            <span className="text-ink-primary">{H.signedConfirm}</span>
          </label>
        )}
      />
      {/* Nút xác nhận khoá tới khi tick — nói rõ vì sao */}
      <p id="handover-signed-hint" className="text-ink-tertiary -mt-1 pl-6 text-xs">
        {H.signedHint}
      </p>
      {missing.length > 0 && (
        <p className="text-ink-secondary text-xs" aria-live="polite">
          {H.missing.prefix}: {missing.join(", ")}
        </p>
      )}
    </>
  );
}
