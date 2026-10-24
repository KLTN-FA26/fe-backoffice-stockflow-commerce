"use client";

import { UI_LABELS } from "@/constants";
import { FLAG_CHOICES } from "@/features/fulfillment/packing-input-schemas";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { Label } from "@/components/ui/label";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import type { FlagChoice } from "@/features/fulfillment/packing-input-schemas";

const SEAL = UI_LABELS.packing.seal;
const TRIGGER =
  "border-border-default bg-bg-surface h-8 w-full rounded-[var(--r-sm)] text-[0.8125rem]";
const FLAG_LABEL: Record<FlagChoice, string> = {
  default: SEAL.flagFromSku,
  yes: SEAL.flagYes,
  no: SEAL.flagNo,
};

export function FlagSelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: FlagChoice;
  onChange: (value: FlagChoice) => void;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-[0.8125rem]">
        {label}
      </Label>
      <Select
        value={value}
        onValueChange={(next) => onChange(FLAG_CHOICES.find((c) => c === next) ?? "default")}
      >
        <SelectTrigger id={id} className={TRIGGER}>
          <SelectValue />
        </SelectTrigger>
        <TitledSelectContent title={label}>
          {FLAG_CHOICES.map((choice) => (
            <SelectItem key={choice} value={choice}>
              {FLAG_LABEL[choice]}
            </SelectItem>
          ))}
        </TitledSelectContent>
      </Select>
    </div>
  );
}
