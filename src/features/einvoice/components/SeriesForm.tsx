"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { EINVOICE_LIMITS, EINVOICE_PROVIDER_CODES } from "@/constants/einvoice";
import { FormField, fieldA11y } from "@/components/shared/FormField";
import { FormSelect } from "@/components/shared/FormSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shared/combobox-select";

import { applyEInvoiceFieldErrors, einvoiceErrorMessage } from "../errors";
import { seriesInputSchema, seriesInputSchemaFor } from "../input-schemas";
import { useSelectSeries } from "../mutations";

import type { z } from "zod";
import type { SeriesInput } from "../types";

type Values = z.input<typeof seriesInputSchema>;
/** Năm nay và một năm liền kề mỗi bên, trong khoảng BE nhận (`EINVOICE_LIMITS.yearMin..yearMax`). */
const yearChoices = (current: number) =>
  [current - 1, current, current + 1].filter(
    (value) => value >= EINVOICE_LIMITS.yearMin && value <= EINVOICE_LIMITS.yearMax,
  );
const SERIES_FIELDS = ["symbol", "year", "providerTemplateCode"] as const;

/**
 * Ký hiệu hoá đơn của một năm (docs 21 §2, BR-07): mẫu số 1 (hoá đơn GTGT), ký hiệu dạng `C26TAA` —
 * C/K (có / không mã), 2 số năm, loại hoá đơn, 2 chữ do doanh nghiệp đặt. Mã mẫu của NCC bắt buộc với NCC thật và
 * không có với sandbox (BO-10, BE `useSeries`).
 */
export function SeriesForm({ provider }: { provider: string }) {
  const [error, setError] = useState<string | null>(null);
  const select = useSelectSeries();
  const year = new Date().getFullYear();
  const sandbox = provider === EINVOICE_PROVIDER_CODES.sandbox;
  const form = useForm<Values, unknown, SeriesInput>({
    resolver: zodResolver(seriesInputSchemaFor(sandbox)),
    defaultValues: { templateCode: "1", symbol: "", year, providerTemplateCode: "" },
  });
  const { errors } = form.formState;
  const submit = form.handleSubmit((values) => {
    setError(null);
    select.mutate(
      { provider, ...values },
      {
        onSuccess: () => form.reset(),
        onError: (failure) => {
          const mapped = applyEInvoiceFieldErrors(failure, SERIES_FIELDS, (field, message) =>
            form.setError(field, { type: "server", message }),
          );
          if (!mapped) setError(einvoiceErrorMessage(failure));
        },
      },
    );
  });

  return (
    <form className="grid gap-3 md:grid-cols-4" onSubmit={(event) => void submit(event)}>
      <FormField id="series-symbol" label="Ký hiệu" required error={errors.symbol?.message}>
        <Input
          placeholder="C26TAA"
          className="font-mono uppercase"
          {...fieldA11y("series-symbol", errors.symbol?.message)}
          {...form.register("symbol")}
        />
      </FormField>
      <FormField id="series-year" label="Năm" required error={errors.year?.message}>
        <Controller
          control={form.control}
          name="year"
          render={({ field }) => (
            // Năm áp dụng của dải hoá đơn: chọn trong vài năm quanh năm nay, không gõ số (UX audit S01-7)
            <FormSelect
              value={String(field.value)}
              onValueChange={(value) => field.onChange(Number(value))}
            >
              <SelectTrigger {...fieldA11y("series-year", errors.year?.message)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearChoices(year).map((choice) => (
                  <SelectItem key={choice} value={String(choice)}>
                    {choice}
                  </SelectItem>
                ))}
              </SelectContent>
            </FormSelect>
          )}
        />
      </FormField>
      {!sandbox && (
        <FormField
          id="series-provider-template"
          label="Mã mẫu của nhà cung cấp"
          required
          error={errors.providerTemplateCode?.message}
        >
          <Input
            placeholder="1/001"
            {...fieldA11y("series-provider-template", errors.providerTemplateCode?.message)}
            {...form.register("providerTemplateCode")}
          />
        </FormField>
      )}
      <div className="flex items-end gap-3">
        <Button type="submit" size="sm" disabled={select.isPending}>
          Dùng ký hiệu
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-danger text-[0.8125rem] md:col-span-4">
          {error}
        </p>
      )}
    </form>
  );
}
