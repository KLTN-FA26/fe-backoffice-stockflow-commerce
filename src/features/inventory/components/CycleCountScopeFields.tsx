"use client";

import { CYCLE_COUNT_CREATE_LABELS } from "@/constants/cycle-count";

import { FormField, fieldA11y } from "@/components/shared/FormField";
import { FORM_TEXTAREA_CLASS } from "@/components/shared/form-control-classes";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

import type { PlanFormValues } from "../cycle-count-plan-form";

const C = CYCLE_COUNT_CREATE_LABELS;

type Zone = { id: string; name: string };

/** The scope of a sheet planned by hand (docs 20 §3): zones, shelves, bins and SKUs - at least one of them. */
export function CycleCountScopeFields({
  values,
  zones,
  error,
  onChange,
}: {
  values: PlanFormValues;
  zones: readonly Zone[];
  /** "Name at least one …": shown under the last field. */
  error?: string;
  onChange: (patch: Partial<PlanFormValues>) => void;
}) {
  const text = (id: string, key: "shelves" | "locations" | "skus", label: string, hint: string) => (
    <FormField id={id} label={label} hint={hint} error={key === "skus" ? error : undefined}>
      <Textarea
        {...fieldA11y(id, key === "skus" ? error : undefined, true)}
        rows={2}
        value={values[key]}
        className={FORM_TEXTAREA_CLASS}
        onChange={(event) => onChange({ [key]: event.target.value })}
      />
    </FormField>
  );
  return (
    <fieldset className="min-w-0 space-y-3 border-0 p-0">
      <legend className="text-ink-secondary text-xs font-medium">{C.scope}</legend>
      {zones.length > 0 && (
        <div role="group" aria-label={C.zones} className="flex flex-wrap gap-x-4 gap-y-1.5">
          {zones.map((zone) => (
            <label
              key={zone.id}
              className="text-ink-secondary flex items-center gap-2 text-[0.8125rem]"
            >
              <Checkbox
                checked={values.zoneIds.includes(zone.id)}
                onCheckedChange={(checked) =>
                  onChange({
                    zoneIds:
                      checked === true
                        ? [...values.zoneIds, zone.id]
                        : values.zoneIds.filter((id) => id !== zone.id),
                  })
                }
              />
              {zone.name}
            </label>
          ))}
        </div>
      )}
      {text("plan-shelves", "shelves", C.shelves, C.shelvesHint)}
      {text("plan-locations", "locations", C.locations, C.locationsHint)}
      {text("plan-skus", "skus", C.skus, C.skusHint)}
    </fieldset>
  );
}
