"use client";

import { Controller } from "react-hook-form";

import { SHIPPING_LIMITS, UI_LABELS } from "@/constants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { FieldError, MONO, fieldClass } from "../primitives";
import { CarrierApiFields } from "./CarrierApiFields";
import { CarrierFailureReasonTable } from "./CarrierFailureReasonTable";
import { CarrierPickupPointTable } from "./CarrierPickupPointTable";
import { CarrierServiceCodeTable } from "./CarrierServiceCodeTable";
import { ConnectionTypeCards } from "./ConnectionTypeCards";

import type { UseFormReturn } from "react-hook-form";
import type { CarrierFormInput, CarrierValues } from "@/features/shipping/types";
import type { useCarrierForm } from "./useCarrierForm";

const FORM = UI_LABELS.shipping.waybill.carriers.form;

type CarrierFormState = ReturnType<typeof useCarrierForm>;

/**
 * Kiểu kết nối của hãng (thẻ chọn) và phần cấu hình của kiểu đó (docs 09 §4.1): webhook theo chuyến → khoá bí mật; tích hợp API
 * đặt xe → môi trường, tài khoản, khoá API, xác thực webhook, mã dịch vụ, điểm lấy hàng. Bảng lý do giao thất bại có ở mọi kiểu
 * có webhook. Khoá chỉ đi vào, không hiện lại: đã lưu thì để trống = giữ khoá hiện tại.
 */
export function CarrierConnectionFields({
  form,
  state,
}: {
  form: UseFormReturn<CarrierFormInput, unknown, CarrierValues>;
  state: CarrierFormState;
}) {
  const errors = form.formState.errors;
  const { type, tables } = state;
  return (
    <div className="space-y-4">
      <div>
        <span
          id="carrier-connectionType-label"
          className="text-ink-secondary mb-1 block text-xs font-medium"
        >
          {FORM.connectionType}
        </span>
        <Controller
          control={form.control}
          name="connectionType"
          render={({ field }) => (
            <ConnectionTypeCards value={field.value} onChange={field.onChange} />
          )}
        />
      </div>
      {type === "WEBHOOK_LOAD" && (
        <div>
          <Label
            htmlFor="carrier-webhookSecret"
            className="text-ink-secondary mb-1 block text-xs font-medium"
          >
            {FORM.webhookSecret} {!state.secretSaved && <span className="text-danger">*</span>}
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
            {state.secretSaved ? FORM.webhookSecretSaved : FORM.webhookSecretNew}
          </p>
          <FieldError>{errors.webhookSecret?.message}</FieldError>
        </div>
      )}
      {state.api && (
        <>
          <CarrierApiFields
            form={form}
            saved={state.savedConnection}
            replacing={state.replacing}
            setReplacing={state.setReplacing}
            rotationUnderWay={state.rotationUnderWay}
          />
          <CarrierServiceCodeTable
            editor={tables.serviceCodes}
            errors={tables.serviceErrors}
            lookupCarrierId={state.savedAsApi ? state.carrierId : undefined}
          />
          <CarrierPickupPointTable editor={tables.pickupPoints} errors={tables.pickupErrors} />
        </>
      )}
      {state.usesFailureReasons && (
        <CarrierFailureReasonTable editor={tables.failureReasons} errors={tables.failureErrors} />
      )}
    </div>
  );
}
