"use client";

import { useWatch } from "react-hook-form";

import {
  CONTRACT_ESIGN_LABELS as L,
  CONTRACT_ESIGN_LIMITS as LIMITS,
} from "@/constants/contract-esign";

import { FormField, FORM_INPUT_CLASS, fieldA11y } from "@/components/shared/FormField";
import { StatusDot as StatusBadge } from "@/components/shared/StatusDot";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import type { SalesContract } from "../../sales-contract-schemas";
import type { UseFormReturn } from "react-hook-form";
import type { ContractFormOutput, ContractFormValues } from "../../sales-contract-form";

const NUMERIC_FIELDS = ["penaltyPercent", "quantityTolerancePercent", "warrantyMonths"] as const;
const SIGNER_FIELDS = [
  "sellerSignerName",
  "sellerSignerTitle",
  "authorizationRef",
  "buyerSignerName",
  "buyerSignerTitle",
] as const;

export function ContractTermsEditor({
  form,
  standardTerms,
}: {
  standardTerms?: SalesContract["standardTerms"];
  form: UseFormReturn<ContractFormValues, unknown, ContractFormOutput>;
}) {
  const terms = useWatch({ control: form.control, name: "specialTerms" }) ?? "";
  const numeric = useWatch({ control: form.control, name: NUMERIC_FIELDS });
  const nonstandard =
    !!terms.trim() ||
    NUMERIC_FIELDS.some(
      (field, index) =>
        numeric[index] != null &&
        numeric[index] !== "" &&
        standardTerms?.[field] != null &&
        Number(numeric[index]) !== standardTerms[field],
    );
  const errors = form.formState.errors;
  return (
    <>
      <fieldset className="space-y-3">
        <legend className="text-ink-primary text-sm font-semibold">{L.terms}</legend>
        {nonstandard && <StatusBadge domain="order" status="Nonstandard" />}
        <FormField
          id="contract-special-terms"
          label={L.specialTerms}
          error={errors.specialTerms?.message}
        >
          <Textarea
            {...form.register("specialTerms")}
            {...fieldA11y("contract-special-terms", errors.specialTerms?.message)}
            maxLength={LIMITS.specialTerms}
            className={FORM_INPUT_CLASS}
          />
          <p className="text-ink-tertiary text-right text-xs tabular-nums" aria-live="polite">
            {terms.length} / {LIMITS.specialTerms}
          </p>
        </FormField>
        <div className="grid gap-3 sm:grid-cols-3">
          {NUMERIC_FIELDS.map((name) => (
            <FormField
              key={name}
              id={`contract-${name}`}
              label={L[name]}
              error={errors[name]?.message}
            >
              <Input
                {...form.register(name)}
                {...fieldA11y(`contract-${name}`, errors[name]?.message)}
                inputMode="numeric"
                placeholder={
                  standardTerms?.[name] != null ? String(standardTerms[name]) : undefined
                }
                className={FORM_INPUT_CLASS}
              />
            </FormField>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="text-ink-primary text-sm font-semibold">{L.signers}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {SIGNER_FIELDS.map((name) => (
            <FormField
              key={name}
              id={`contract-${name}`}
              label={L[name]}
              error={errors[name]?.message}
            >
              <Input
                {...form.register(name)}
                {...fieldA11y(`contract-${name}`, errors[name]?.message)}
                maxLength={name === "authorizationRef" ? LIMITS.authorization : LIMITS.signer}
                className={FORM_INPUT_CLASS}
              />
            </FormField>
          ))}
        </div>
      </fieldset>
    </>
  );
}
