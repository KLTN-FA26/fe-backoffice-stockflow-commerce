"use client";

import { Controller } from "react-hook-form";

import { UI_LABELS } from "@/constants";
import { FormSelect } from "@/components/shared/FormSelect";
import { FORM_SELECT_CLASS } from "@/components/shared/form-control-classes";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";

import { REMOVAL_STRATEGIES, TRACKING_MODES } from "../../schemas";
import { Field } from "./Field";

import type { UseFormReturn } from "react-hook-form";
import type { PolicyFormValues } from "../../types";

const L = UI_LABELS.inventoryItem;
const F = L.field;

/** Hai ô chọn cách xuất kho / theo dõi của form chính sách; `onChange` để form kiểm lại luật chéo ô. */
export function ItemPolicySelects({
  form,
  onChange,
}: {
  form: UseFormReturn<PolicyFormValues>;
  onChange: () => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label={F.removalStrategy} id="pl-removal">
        <Controller
          control={form.control}
          name="removalStrategy"
          render={({ field }) => (
            <FormSelect
              value={field.value}
              onValueChange={(v) => {
                field.onChange(v);
                onChange();
              }}
            >
              <SelectTrigger id="pl-removal" className={FORM_SELECT_CLASS}>
                <SelectValue />
              </SelectTrigger>
              <TitledSelectContent title={F.removalStrategy}>
                {REMOVAL_STRATEGIES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {L.removalStrategy[s]}
                  </SelectItem>
                ))}
              </TitledSelectContent>
            </FormSelect>
          )}
        />
      </Field>
      <Field label={F.trackingMode} id="pl-tracking">
        <Controller
          control={form.control}
          name="trackingMode"
          render={({ field }) => (
            <FormSelect
              value={field.value}
              onValueChange={(v) => {
                field.onChange(v);
                onChange();
              }}
            >
              <SelectTrigger id="pl-tracking" className={FORM_SELECT_CLASS}>
                <SelectValue />
              </SelectTrigger>
              <TitledSelectContent title={F.trackingMode}>
                {TRACKING_MODES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {L.trackingMode[m]}
                  </SelectItem>
                ))}
              </TitledSelectContent>
            </FormSelect>
          )}
        />
      </Field>
    </div>
  );
}
