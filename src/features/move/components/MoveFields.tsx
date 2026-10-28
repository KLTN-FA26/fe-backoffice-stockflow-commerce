import { MOVE_LABELS, MOVE_LIMITS } from "@/constants/move";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { UseFormReturn } from "react-hook-form";
import type { MoveCreateInput } from "../types";

const DESTINATION_LIST_ID = "move-toLocation-options";

function FieldError({ id, message }: { id: string; message?: string }) {
  return (
    <p id={id} role={message ? "alert" : undefined} className="text-danger text-sm">
      {message}
    </p>
  );
}

export function MoveFields({
  form,
  destinations,
  movable,
}: {
  form: UseFormReturn<MoveCreateInput>;
  destinations: readonly string[];
  /** Units that may leave the chosen source row; undefined while the source row is unknown. */
  movable: number | undefined;
}) {
  const {
    register,
    formState: { errors },
  } = form;
  const text = (
    field: "sku" | "lotNumber" | "fromLocation" | "toLocation",
    label: string,
    limit: number,
    help?: string,
    required = true,
  ) => (
    <div key={field}>
      <Label htmlFor={`move-${field}`}>
        {label}
        {required && " *"}
      </Label>
      <Input
        className="bg-bg-surface rounded-[var(--r-sm)]"
        id={`move-${field}`}
        {...register(field)}
        maxLength={limit}
        autoComplete="off"
        list={field === "toLocation" ? DESTINATION_LIST_ID : undefined}
        aria-invalid={Boolean(errors[field])}
        aria-describedby={`move-${field}-error${help ? ` move-${field}-help` : ""}`}
      />
      {help && (
        <p id={`move-${field}-help`} className="text-ink-secondary text-sm">
          {help}
        </p>
      )}
      <FieldError id={`move-${field}-error`} message={errors[field]?.message} />
    </div>
  );
  return (
    <div className="grid grid-cols-1 gap-[var(--card-pad)] md:grid-cols-2">
      {text("sku", MOVE_LABELS.sku, 64, MOVE_LABELS.skuHelp)}
      {text("lotNumber", MOVE_LABELS.lot, MOVE_LIMITS.lotLength, MOVE_LABELS.lotHelp, false)}
      {text("fromLocation", MOVE_LABELS.fromLocation, MOVE_LIMITS.locationLength)}
      {text(
        "toLocation",
        MOVE_LABELS.toLocation,
        MOVE_LIMITS.locationLength,
        destinations.length ? MOVE_LABELS.toLocationHelp : undefined,
      )}
      <datalist id={DESTINATION_LIST_ID}>
        {destinations.map((code) => (
          <option key={code} value={code} />
        ))}
      </datalist>
      <div>
        <Label htmlFor="move-quantity">{MOVE_LABELS.quantity} *</Label>
        <Input
          className="bg-bg-surface rounded-[var(--r-sm)]"
          id="move-quantity"
          type="number"
          step={1}
          min={MOVE_LIMITS.quantityMin}
          max={MOVE_LIMITS.quantityMax}
          {...register("quantity", { valueAsNumber: true })}
          aria-invalid={Boolean(errors.quantity)}
          aria-describedby="move-quantity-help move-quantity-error"
        />
        <p id="move-quantity-help" className="text-ink-secondary text-sm">
          {MOVE_LABELS.quantityHelp}
          {movable !== undefined && ` ${MOVE_LABELS.movableUpTo}: ${movable}.`}
        </p>
        <FieldError id="move-quantity-error" message={errors.quantity?.message} />
      </div>
    </div>
  );
}
