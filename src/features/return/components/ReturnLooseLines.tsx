"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PackagePlus } from "lucide-react";

import { RETURN_RECEIPT_LABELS } from "@/constants/labels-return";
import { RETURN_LIMITS } from "@/constants/returns";
import { ApiError } from "@/lib/api/error";
import { Card } from "@/components/shared/Card";
import { FormField, fieldA11y } from "@/components/shared/FormField";
import { FORM_INPUT_CLASS } from "@/components/shared/form-control-classes";
import { Notice } from "@/components/shared/Notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { returnErrorMessage } from "../errors";
import { looseLineInputSchema } from "../input-schemas";
import { useRecordLooseLine, useRemoveLooseLine } from "../mutations";

import { EMPTY, MONO } from "./primitives";

import type { LooseLineFormValues, ReturnReceipt } from "../types";

const D = RETURN_RECEIPT_LABELS.detail.loose;
const TH = "py-1 pr-3 font-medium";
/** BE trả VALIDATION_FAILED chung khi SKU không thuộc đơn. */
const looseErrorMessage = (failure: unknown) =>
  failure instanceof ApiError && failure.code === "VALIDATION_FAILED"
    ? D.invalid
    : returnErrorMessage(failure);

function LooseLineForm({ receiptId }: { receiptId: string }) {
  const [error, setError] = useState<string | null>(null);
  const record = useRecordLooseLine();
  const form = useForm<LooseLineFormValues>({
    resolver: zodResolver(looseLineInputSchema),
    defaultValues: { sku: "", lotNumber: "", quantity: Number.NaN },
  });
  const { errors } = form.formState;
  const submit = form.handleSubmit((values) => {
    setError(null);
    record.mutate(
      { id: receiptId, ...values },
      {
        onSuccess: () => form.reset(),
        onError: (failure) => setError(looseErrorMessage(failure)),
      },
    );
  });

  return (
    <form
      className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem_auto] sm:items-end"
      onSubmit={(event) => void submit(event)}
      noValidate
    >
      <FormField id="rr-loose-sku" label={D.sku} required error={errors.sku?.message}>
        <Input
          maxLength={RETURN_LIMITS.skuMax}
          className={`${FORM_INPUT_CLASS} font-[family-name:var(--font-mono)]`}
          {...fieldA11y("rr-loose-sku", errors.sku?.message)}
          {...form.register("sku")}
        />
      </FormField>
      <FormField id="rr-loose-lot" label={D.lot} error={errors.lotNumber?.message}>
        <Input
          maxLength={RETURN_LIMITS.lotMax}
          className={`${FORM_INPUT_CLASS} font-[family-name:var(--font-mono)]`}
          {...fieldA11y("rr-loose-lot", errors.lotNumber?.message)}
          {...form.register("lotNumber")}
        />
      </FormField>
      <FormField id="rr-loose-qty" label={D.quantity} required error={errors.quantity?.message}>
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          className={`${FORM_INPUT_CLASS} tabular-nums`}
          {...fieldA11y("rr-loose-qty", errors.quantity?.message)}
          {...form.register("quantity", { valueAsNumber: true })}
        />
      </FormField>
      <Button type="submit" size="sm" disabled={record.isPending}>
        <PackagePlus className="size-3.5" aria-hidden /> {D.add}
      </Button>
      {error && (
        <div className="sm:col-span-4">
          <Notice tone="danger" live>
            {error}
          </Notice>
        </div>
      )}
    </form>
  );
}

/**
 * Hàng lẻ không nhãn thùng của phiếu (WF-05 TH-4; BE `/goods-receipts/returns/{id}/loose-lines`): ghi trên phiếu, không
 * nhập tồn, tính là đã về cho yêu cầu trả hàng. `editable` = phiếu nháp của một yêu cầu trả hàng và có quyền sửa
 * (`allowedReturnReceiptActions` → `loose`).
 */
export function ReturnLooseLines({
  receipt,
  editable,
}: {
  receipt: ReturnReceipt;
  editable: boolean;
}) {
  const remove = useRemoveLooseLine();
  const lines = receipt.looseLines ?? [];
  if (!editable && lines.length === 0) return null;

  return (
    <Card className="space-y-3">
      <h2 className="text-ink-primary text-sm font-semibold">{D.title}</h2>
      {editable && <p className="text-ink-tertiary text-xs">{D.hint}</p>}
      {editable && <LooseLineForm receiptId={receipt.id} />}
      {lines.length === 0 ? (
        <p className="text-ink-tertiary text-[0.8125rem]">{D.none}</p>
      ) : (
        <table className="w-full text-[0.8125rem]">
          <caption className="sr-only">{D.title}</caption>
          <thead className="text-ink-tertiary text-left">
            <tr>
              <th scope="col" className={TH}>
                {D.sku}
              </th>
              <th scope="col" className={TH}>
                {D.lot}
              </th>
              <th scope="col" className={`${TH} text-right`}>
                {D.quantity}
              </th>
              {editable && <th scope="col" className={TH} aria-label={D.remove} />}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--table-line)]">
            {lines.map((line) => (
              <tr key={line.id}>
                <td className={`py-1.5 pr-3 ${MONO}`}>{line.sku}</td>
                <td className={`py-1.5 pr-3 ${MONO}`}>{line.lotNumber ?? EMPTY}</td>
                <td className={`py-1.5 pr-3 text-right ${MONO}`}>{line.quantity}</td>
                {editable && (
                  <td className="py-1.5 text-right">
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      disabled={remove.isPending}
                      aria-label={`${D.remove} ${line.sku}`}
                      onClick={() => remove.mutate({ id: receipt.id, lineId: line.id })}
                    >
                      {D.remove}
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
