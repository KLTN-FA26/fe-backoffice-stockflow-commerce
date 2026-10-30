"use client";

import { UI_LABELS } from "@/constants";

import { FormField, TextInput } from "../shared/form-parts";

import type { UseFormReturn } from "react-hook-form";
import type { WarehouseCreateBody, WarehouseCreateInput } from "@/features/warehouse-map/types";

const L = UI_LABELS.warehouseMap;
const NUM = "text-right tabular-nums";
const MONO = "font-[family-name:var(--font-mono)] uppercase";

type Form = UseFormReturn<WarehouseCreateInput, unknown, WarehouseCreateBody>;
type TextName = Exclude<keyof WarehouseCreateInput, "mapUnit">;

/** Hai khối của form khai báo kho: thông tin chung và khung bản đồ (docs 06 §3 Input "Khung kho"). */
export function WarehouseCreateFields({ form }: { form: Form }) {
  const errors = form.formState.errors;
  const text = (
    name: TextName,
    opts: { required?: boolean; hint?: string; className?: string; autoFocus?: boolean } = {},
  ) => (
    <FormField
      id={`wh-${name}`}
      label={L.field[name]}
      required={opts.required}
      hint={opts.hint}
      error={errors[name]?.message}
    >
      <TextInput
        id={`wh-${name}`}
        error={errors[name]?.message}
        autoComplete="off"
        autoFocus={opts.autoFocus}
        inputMode={opts.className === NUM ? "decimal" : undefined}
        className={opts.className}
        {...form.register(name)}
      />
    </FormField>
  );

  return (
    <>
      <section className="space-y-3">
        <h3 className="text-ink-primary text-sm font-semibold">{L.form.sectionGeneral}</h3>
        <div className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-3">
          {text("prefix", {
            required: true,
            hint: L.form.prefixHint,
            className: MONO,
            autoFocus: true,
          })}
          {text("name", { required: true })}
        </div>
        {text("address", { required: true })}
        {text("returnAddress", { hint: L.form.returnAddressHint })}
      </section>
      <section className="space-y-3">
        <h3 className="text-ink-primary text-sm font-semibold">{L.form.sectionMap}</h3>
        <div className="grid grid-cols-3 gap-3">
          <FormField id="wh-mapUnit" label={L.field.mapUnit} hint={L.form.mapUnitHint}>
            {/* BR-13: đơn vị bản đồ chỉ mét và không đổi — hiển thị, không cho chọn */}
            <TextInput id="wh-mapUnit" value="M" readOnly disabled className={MONO} />
          </FormField>
          {text("mapWidth", { required: true, className: NUM })}
          {text("mapHeight", { required: true, className: NUM })}
        </div>
        <p className="text-ink-tertiary text-xs">{L.form.mapHint}</p>
      </section>
    </>
  );
}
