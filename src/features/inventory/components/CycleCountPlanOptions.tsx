"use client";

import {
  CYCLE_COUNT_CREATE_LABELS,
  CYCLE_COUNT_LABELS,
  CYCLE_COUNT_LIMITS,
} from "@/constants/cycle-count";

import { DatePicker } from "@/components/shared/DatePicker";
import { FormField, fieldA11y } from "@/components/shared/FormField";
import { FORM_SELECT_CLASS, FORM_TEXTAREA_CLASS } from "@/components/shared/form-control-classes";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shared/combobox-select";
import { Textarea } from "@/components/ui/textarea";

import type { PlanFormValues } from "../cycle-count-plan-form";
import type { CycleCountAssignee } from "../cycle-count-types";

const C = CYCLE_COUNT_CREATE_LABELS;
const NONE = "none";

/** Blind or not, the day, a note and who counts (docs 20 §3): all optional, blind on by default. */
export function CycleCountPlanOptions({
  values,
  assignees,
  onChange,
}: {
  values: PlanFormValues;
  assignees: readonly CycleCountAssignee[];
  onChange: (patch: Partial<PlanFormValues>) => void;
}) {
  return (
    <>
      <label className="text-ink-secondary flex items-start gap-2 text-[0.8125rem]">
        <Checkbox
          className="mt-0.5"
          checked={values.blind}
          onCheckedChange={(checked) => onChange({ blind: checked === true })}
        />
        <span>
          <span className="text-ink-primary block font-medium">{CYCLE_COUNT_LABELS.blind}</span>
          <span className="text-ink-tertiary block text-xs">{C.blindHint}</span>
        </span>
      </label>
      <FormField id="plan-date" label={C.plannedDate} hint={C.plannedDateHint}>
        <DatePicker
          id="plan-date"
          clearable
          value={values.plannedDate}
          placeholder={C.plannedDatePlaceholder}
          onChange={(plannedDate) => onChange({ plannedDate })}
        />
      </FormField>
      <FormField id="plan-note" label={C.note} hint={C.noteHint}>
        <Textarea
          {...fieldA11y("plan-note", undefined, true)}
          rows={2}
          maxLength={CYCLE_COUNT_LIMITS.noteLength}
          value={values.note}
          className={FORM_TEXTAREA_CLASS}
          onChange={(event) => onChange({ note: event.target.value })}
        />
      </FormField>
      <FormField id="plan-counter" label={C.counter} hint={C.counterHint}>
        <Select
          value={values.assignedUserId || NONE}
          onValueChange={(value) => onChange({ assignedUserId: value === NONE ? "" : value })}
        >
          <SelectTrigger
            {...fieldA11y("plan-counter", undefined, true)}
            className={FORM_SELECT_CLASS}
          >
            <SelectValue placeholder={C.counterPlaceholder} />
          </SelectTrigger>
          <TitledSelectContent title={C.counter}>
            <SelectItem value={NONE}>{C.counterPlaceholder}</SelectItem>
            {assignees.map((user) => (
              <SelectItem key={user.userId} value={user.userId}>
                {user.displayName}
              </SelectItem>
            ))}
          </TitledSelectContent>
        </Select>
      </FormField>
    </>
  );
}
