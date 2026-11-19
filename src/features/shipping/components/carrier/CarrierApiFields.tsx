"use client";

import { useWatch } from "react-hook-form";

import { CARRIER_CONFIG_LIMITS, UI_LABELS } from "@/constants";
import { Alert } from "@/components/shared/Alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { FieldError, MONO, fieldClass } from "../primitives";
import { ApiEnvironmentField } from "./ApiEnvironmentField";
import { SecretField } from "./SecretField";

import type { UseFormReturn } from "react-hook-form";
import type { SavedCarrierConnection } from "@/features/shipping/carrier-schemas";
import type { CarrierFormInput, CarrierValues } from "@/features/shipping/types";

const A = UI_LABELS.shipping.waybill.carriers.config.api;

/**
 * Khối "Kết nối API đặt xe": môi trường, tài khoản, khoá API (chỉ đi vào), header + giá trị xác thực webhook (giá trị chỉ đi
 * vào; tên header hiện rõ). Đổi môi trường / tài khoản của hãng đã có khoá thì buộc nhập lại khoá API (luật BE).
 */
export function CarrierApiFields({
  form,
  saved,
  replacing,
  setReplacing,
  rotationUnderWay,
}: {
  form: UseFormReturn<CarrierFormInput, unknown, CarrierValues>;
  saved: SavedCarrierConnection;
  replacing: { apiKey: boolean; webhookAuthValue: boolean };
  setReplacing: (name: "apiKey" | "webhookAuthValue", value: boolean) => void;
  rotationUnderWay: boolean;
}) {
  const errors = form.formState.errors;
  const [environment, account] = useWatch({
    control: form.control,
    name: ["apiEnvironment", "apiAccount"],
  });
  const trimmed = (account ?? "").trim();
  const keyMustChange =
    saved.apiKey &&
    ((environment ?? "") !== (saved.apiEnvironment ?? "") ||
      trimmed !== (saved.apiAccount ?? "").trim());
  return (
    <fieldset className="border-border-default m-0 min-w-0 rounded-[var(--r-md)] border p-3.5">
      <legend className="text-ink-primary px-1 text-[0.8125rem] font-semibold">{A.title}</legend>
      <p className="text-ink-secondary mb-3 text-xs">{A.description}</p>
      <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
        <ApiEnvironmentField form={form} />
        <div>
          <Label
            htmlFor="carrier-apiAccount"
            className="text-ink-secondary mb-1 block text-xs font-medium"
          >
            {A.account} <span className="text-danger">*</span>
          </Label>
          <Input
            id="carrier-apiAccount"
            autoComplete="off"
            maxLength={CARRIER_CONFIG_LIMITS.apiAccountMax}
            aria-invalid={errors.apiAccount ? true : undefined}
            className={`${fieldClass(!!errors.apiAccount)} ${MONO}`}
            {...form.register("apiAccount")}
          />
          <p className="text-ink-tertiary mt-1 text-xs">{A.accountHint}</p>
          <FieldError>{errors.apiAccount?.message}</FieldError>
        </div>
        <div className="sm:col-span-2">
          <SecretField
            id="carrier-apiKey"
            label={A.apiKey}
            hint={keyMustChange ? A.apiKeyChangeNeedsNew : A.apiKeyHint}
            saved={saved.apiKey}
            replacing={replacing.apiKey}
            mustReplace={keyMustChange}
            onReplace={() => setReplacing("apiKey", true)}
            onKeep={() => setReplacing("apiKey", false)}
            registration={form.register("apiKey")}
            error={errors.apiKey?.message}
            maxLength={CARRIER_CONFIG_LIMITS.apiKeyMax}
          />
        </div>
        <div>
          <Label
            htmlFor="carrier-webhookAuthHeader"
            className="text-ink-secondary mb-1 block text-xs font-medium"
          >
            {A.webhookAuthHeader} <span className="text-danger">*</span>
          </Label>
          <Input
            id="carrier-webhookAuthHeader"
            autoComplete="off"
            maxLength={CARRIER_CONFIG_LIMITS.webhookAuthHeaderMax}
            aria-invalid={errors.webhookAuthHeader ? true : undefined}
            className={`${fieldClass(!!errors.webhookAuthHeader)} ${MONO}`}
            {...form.register("webhookAuthHeader")}
          />
          <p className="text-ink-tertiary mt-1 text-xs">{A.webhookAuthHeaderHint}</p>
          <FieldError>{errors.webhookAuthHeader?.message}</FieldError>
        </div>
        <SecretField
          id="carrier-webhookAuthValue"
          label={A.webhookAuthValue}
          hint={A.webhookAuthValueHint}
          saved={saved.webhookAuthValue}
          replacing={replacing.webhookAuthValue}
          onReplace={() => setReplacing("webhookAuthValue", true)}
          onKeep={() => setReplacing("webhookAuthValue", false)}
          registration={form.register("webhookAuthValue")}
          error={errors.webhookAuthValue?.message}
          maxLength={CARRIER_CONFIG_LIMITS.webhookAuthValueMax}
        />
      </div>
      {rotationUnderWay && (
        <Alert tone="info" className="mt-3">
          {A.rotationUnderWay}
        </Alert>
      )}
    </fieldset>
  );
}
