"use client";

import { Controller, useWatch } from "react-hook-form";

import { CARRIER_CONNECTION_TYPE, SHIPPING_LIMITS, UI_LABELS } from "@/constants";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { FieldError, MONO, fieldClass } from "../primitives";

import type { UseFormReturn } from "react-hook-form";
import type { CarrierFormInput, CarrierValues } from "@/features/shipping/types";

const C = UI_LABELS.shipping.waybill.carriers;
const FORM = C.form;
const TRIGGER =
  "border-border-default bg-bg-surface h-8 w-full rounded-[var(--r-sm)] text-[0.8125rem]";
/** Các kiểu kết nối chỉnh được ở màn này; API đặt xe cần cấu hình thêm (khoá, điểm lấy hàng, mã dịch vụ) nên chưa có. */
const EDITABLE_TYPES = [
  CARRIER_CONNECTION_TYPE.MANUAL,
  CARRIER_CONNECTION_TYPE.WEBHOOK_LOAD,
] as const;

/**
 * Kiểu kết nối của hãng (không có webhook / webhook theo chuyến) và khoá bí mật webhook. Khoá chỉ đi vào, không hiện lại:
 * đã lưu thì để trống = giữ khoá hiện tại. Hãng tích hợp API đặt xe: kiểu kết nối và cấu hình API giữ nguyên.
 */
export function CarrierConnectionFields({
  form,
  locked,
  secretSaved,
}: {
  form: UseFormReturn<CarrierFormInput, unknown, CarrierValues>;
  /** Hãng tích hợp API đặt xe: chỉ sửa thông tin chung. */
  locked: boolean;
  secretSaved: boolean;
}) {
  const type = useWatch({ control: form.control, name: "connectionType" });
  const errors = form.formState.errors;
  if (locked) return <p className="text-ink-secondary text-xs">{FORM.apiBookingLocked}</p>;
  return (
    <>
      <div>
        <Label
          htmlFor="carrier-connectionType"
          className="text-ink-secondary mb-1 block text-xs font-medium"
        >
          {FORM.connectionType}
        </Label>
        <Controller
          control={form.control}
          name="connectionType"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="carrier-connectionType" className={TRIGGER}>
                <SelectValue />
              </SelectTrigger>
              <TitledSelectContent title={FORM.connectionType}>
                {EDITABLE_TYPES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {C.connectionType[value]}
                  </SelectItem>
                ))}
              </TitledSelectContent>
            </Select>
          )}
        />
        <p className="text-ink-tertiary mt-1 text-xs">
          {C.connectionHint[type === "WEBHOOK_LOAD" ? "WEBHOOK_LOAD" : "MANUAL"]}
        </p>
      </div>
      {type === "WEBHOOK_LOAD" && (
        <div>
          <Label
            htmlFor="carrier-webhookSecret"
            className="text-ink-secondary mb-1 block text-xs font-medium"
          >
            {FORM.webhookSecret} {!secretSaved && <span className="text-danger">*</span>}
          </Label>
          <Input
            id="carrier-webhookSecret"
            type="password"
            autoComplete="new-password"
            maxLength={SHIPPING_LIMITS.webhookSecretMax}
            aria-invalid={errors.webhookSecret ? true : undefined}
            className={`${fieldClass(!!errors.webhookSecret)} ${MONO}`}
            {...form.register("webhookSecret")}
          />
          <p className="text-ink-tertiary mt-1 text-xs">
            {secretSaved ? FORM.webhookSecretSaved : FORM.webhookSecretNew}
          </p>
          <FieldError>{errors.webhookSecret?.message}</FieldError>
        </div>
      )}
    </>
  );
}
