"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { FormField, fieldA11y } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { einvoiceErrorMessage } from "../errors";
import { seriesInputSchema } from "../input-schemas";
import { useSelectSeries } from "../mutations";

import type { z } from "zod";
import type { SeriesInput } from "../types";

type Values = z.input<typeof seriesInputSchema>;

/**
 * Ký hiệu hoá đơn của một năm (docs 21 §2, BR-07): mẫu số 1 (hoá đơn GTGT), ký hiệu dạng `C26TAA` —
 * C/K (có / không mã), 2 số năm, loại hoá đơn, 2 chữ do doanh nghiệp đặt.
 */
export function SeriesForm({ provider }: { provider: string }) {
  const [error, setError] = useState<string | null>(null);
  const select = useSelectSeries();
  const year = new Date().getFullYear();
  const form = useForm<Values, unknown, SeriesInput>({
    resolver: zodResolver(seriesInputSchema),
    defaultValues: { templateCode: "1", symbol: "", year, providerTemplateCode: "" },
  });
  const { errors } = form.formState;
  const submit = form.handleSubmit((values) => {
    setError(null);
    select.mutate(
      { provider, ...values },
      {
        onSuccess: () => form.reset(),
        onError: (failure) => setError(einvoiceErrorMessage(failure)),
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
        <Input
          type="number"
          {...fieldA11y("series-year", errors.year?.message)}
          {...form.register("year", { valueAsNumber: true })}
        />
      </FormField>
      <FormField
        id="series-provider-template"
        label="Mã mẫu của nhà cung cấp"
        error={errors.providerTemplateCode?.message}
      >
        <Input
          placeholder="1/001"
          {...fieldA11y("series-provider-template", errors.providerTemplateCode?.message)}
          {...form.register("providerTemplateCode")}
        />
      </FormField>
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
