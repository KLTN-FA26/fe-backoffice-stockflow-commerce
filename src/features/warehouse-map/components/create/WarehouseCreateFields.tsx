"use client";

import { UI_LABELS } from "@/constants";

import { FormField, TextInput } from "../shared/form-parts";
import { HintButton } from "../shared/HintButton";
import { MapFramePreview } from "./MapFramePreview";
import { WarehouseAddressFields } from "./WarehouseAddressFields";

import type { UseFormReturn } from "react-hook-form";
import type { WarehouseCreateBody, WarehouseCreateInput } from "@/features/warehouse-map/types";

const L = UI_LABELS.warehouseMap;
const NUM = "text-right tabular-nums";
const MONO = "font-[family-name:var(--font-mono)] uppercase";

type Form = UseFormReturn<WarehouseCreateInput, unknown, WarehouseCreateBody>;
type TextName = "prefix" | "name" | "returnAddress" | "mapWidth" | "mapHeight";

/**
 * Form khai báo kho, 2 cột: trái — thông tin chung, địa chỉ (tỉnh / xã / số nhà — hành chính 2 cấp), địa
 * chỉ hoàn hàng; phải — khung bản đồ (docs 06 §3 "Khung kho") + xem trước. Lưu ý nằm sau nút "?".
 */
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
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
      <div className="space-y-5">
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
        </section>
        <WarehouseAddressFields form={form} />
        {text("returnAddress", { hint: L.form.returnAddressHint })}
      </div>
      <div className="space-y-5">
        <section className="space-y-3">
          <div className="flex items-center gap-1">
            <h3 className="text-ink-primary text-sm font-semibold">{L.form.sectionMap}</h3>
            <HintButton label={L.form.sectionMap}>{L.form.mapHint}</HintButton>
          </div>
          <FormField id="wh-mapUnit" label={L.field.mapUnit} hint={L.form.mapUnitHint}>
            {/* BR-13: đơn vị bản đồ chỉ mét và không đổi — hiển thị, không cho chọn */}
            <TextInput id="wh-mapUnit" value="M" readOnly disabled className={MONO} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            {text("mapWidth", { required: true, className: NUM })}
            {text("mapHeight", { required: true, className: NUM })}
          </div>
        </section>
        <MapFramePreview control={form.control} />
      </div>
    </div>
  );
}
