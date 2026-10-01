"use client";

import { Landmark } from "lucide-react";
import { useWatch } from "react-hook-form";

import { SUPPLIER_CHANNELS } from "@/constants";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { FieldError, FieldHint, Label, fieldA11y, fieldId, inputCls } from "./fields";

import type { Control, FieldErrors, UseFormRegister, UseFormSetValue } from "react-hook-form";
import type { SupplierChannel, SupplierFormValues } from "../../types";

const CHANNEL_LABEL: Record<SupplierChannel, string> = {
  EMAIL: "Email — gửi PO tới email liên hệ",
  API: "API — gửi PO tới endpoint của NCC",
};

const numberCls = `${inputCls} text-right tabular-nums`;

function isChannel(value: string): value is SupplierChannel {
  return (SUPPLIER_CHANNELS as readonly string[]).includes(value);
}

export function SupplierTermsSection({
  register,
  control,
  setValue,
  errors,
}: {
  register: UseFormRegister<SupplierFormValues>;
  control: Control<SupplierFormValues>;
  setValue: UseFormSetValue<SupplierFormValues>;
  errors: FieldErrors<SupplierFormValues>;
}) {
  const channel = useWatch({ control, name: "communicationChannel" });

  return (
    <section className="bg-bg-surface border-border-default rounded-[var(--r-sm)] border p-4">
      <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-sm font-semibold">
        <Landmark size={16} /> Điều khoản &amp; kênh gửi PO
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={fieldId("paymentTermDays")} required>
            Thời hạn thanh toán (ngày)
          </Label>
          <Input
            type="number"
            {...register("paymentTermDays", { valueAsNumber: true })}
            {...fieldA11y("paymentTermDays", errors.paymentTermDays?.message)}
            min={0}
            max={365}
            className={numberCls}
          />
          <FieldError name="paymentTermDays" message={errors.paymentTermDays?.message} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={fieldId("leadTimeDays")} required>
            Thời gian giao hàng (ngày)
          </Label>
          <Input
            type="number"
            {...register("leadTimeDays", { valueAsNumber: true })}
            {...fieldA11y("leadTimeDays", errors.leadTimeDays?.message)}
            min={0}
            max={365}
            className={numberCls}
          />
          <FieldError name="leadTimeDays" message={errors.leadTimeDays?.message} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={fieldId("communicationChannel")} required>
            Kênh gửi PO
          </Label>
          <Select
            value={channel}
            onValueChange={(v) => {
              if (isChannel(v)) setValue("communicationChannel", v, { shouldValidate: true });
            }}
          >
            <SelectTrigger
              {...fieldA11y("communicationChannel", errors.communicationChannel?.message)}
              className={inputCls}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {SUPPLIER_CHANNELS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CHANNEL_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <FieldError name="communicationChannel" message={errors.communicationChannel?.message} />
        </div>
        {channel === "API" && (
          <div className="space-y-1">
            <Label htmlFor={fieldId("apiEndpoint")} required>
              API endpoint
            </Label>
            <Input
              {...register("apiEndpoint")}
              {...fieldA11y("apiEndpoint", errors.apiEndpoint?.message)}
              placeholder="https://api.nhacungcap.vn/po"
              className={inputCls}
            />
            <FieldError name="apiEndpoint" message={errors.apiEndpoint?.message} />
            <FieldHint>Chỉ nhận https, không kèm query hoặc #fragment.</FieldHint>
          </div>
        )}
      </div>
    </section>
  );
}
