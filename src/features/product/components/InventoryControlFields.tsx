import { Input } from "@/components/ui/input";

import {
  INVENTORY_CONTROL_TEXT as text,
  REMOVAL_STRATEGY_LABELS,
  TRACKING_MODE_LABELS,
} from "../inventory-control/constants";
import { ProductFormField } from "./ProductFormField";

import type { UseFormReturn } from "react-hook-form";
import type { InventoryPolicyDraft } from "../inventory-control/form-model";

const quantityFields = ["reorderPoint", "safetyStock", "maxShelfLifeDays"] as const;
const enumFields = ["removalStrategy", "trackingMode"] as const;
export function InventoryControlFields({ form }: { form: UseFormReturn<InventoryPolicyDraft> }) {
  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
      {quantityFields.map((name) => (
        <ProductFormField
          key={name}
          label={text[name]}
          htmlFor={`inventory-control-${name}`}
          error={form.formState.errors[name]?.message}
        >
          {/* Raw text retains malformed/overflow input; no native number coercion to blank. */}
          <Input
            id={`inventory-control-${name}`}
            type="text"
            inputMode="numeric"
            {...form.register(name)}
          />
        </ProductFormField>
      ))}
      {enumFields.map((name) => (
        <ProductFormField
          key={name}
          label={text[name]}
          htmlFor={`inventory-control-${name}`}
          error={form.formState.errors[name]?.message}
        >
          <select
            id={`inventory-control-${name}`}
            {...form.register(name)}
            className="border-border-default bg-bg-surface text-ink-primary focus-visible:outline-accent h-9 w-full rounded-[var(--r-sm)] border px-3 text-sm focus-visible:outline-2"
          >
            {Object.entries(
              name === "removalStrategy" ? REMOVAL_STRATEGY_LABELS : TRACKING_MODE_LABELS,
            ).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </ProductFormField>
      ))}
      <ProductFormField
        label={text.expiryTracked}
        htmlFor="inventory-control-expiryTracked"
        error={form.formState.errors.expiryTracked?.message}
      >
        <input
          id="inventory-control-expiryTracked"
          type="checkbox"
          {...form.register("expiryTracked")}
        />
      </ProductFormField>
    </div>
  );
}
