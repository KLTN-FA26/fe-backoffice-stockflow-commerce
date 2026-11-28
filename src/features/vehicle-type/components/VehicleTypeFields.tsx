"use client";

import { Controller } from "react-hook-form";

import {
  UI_LABELS,
  VEHICLE_TYPE_KIND_LABELS,
  VEHICLE_TYPE_KINDS,
  VEHICLE_TYPE_STATUS_LABELS,
  VEHICLE_TYPE_STATUSES,
} from "@/constants";
import { fieldA11y } from "@/components/shared/FormField";
import { SegmentedControl } from "@/components/shared/SegmentedControl";

import { FormField, TextInput } from "./form-parts";
import { VolumePreview } from "./VolumePreview";
import { formatMetres } from "../selectors";

import type { UseFormReturn } from "react-hook-form";
import type { VehicleTypeFormInput, VehicleTypeFormValues } from "@/features/vehicle-type/types";

const L = UI_LABELS.vehicleType;
const NUM = "text-right tabular-nums";

type Form = UseFormReturn<VehicleTypeFormInput, unknown, VehicleTypeFormValues>;
type TextName = Exclude<keyof VehicleTypeFormInput, "kind" | "status">;

/**
 * Các ô của form loại xe; mã chỉ nhập lúc tạo (`editing` khoá), trạng thái chỉ chọn lúc sửa. Loại xe
 * mặc định (`preset`) còn khoá thêm loại xe — BE từ chối đổi (`VEHICLE_TYPE_KIND_IMMUTABLE`).
 */
export function VehicleTypeFields({
  form,
  editing,
  preset = false,
}: {
  form: Form;
  editing: boolean;
  preset?: boolean;
}) {
  const errors = form.formState.errors;
  // Nhập mm nhưng nơi khác hiện mét: dưới ô các cạnh (mm) nhắc quy đổi "= 5,898 m" (UX audit S20-2)
  const metresOf = (name: TextName): string | undefined => {
    if (!name.endsWith("Mm")) return undefined;
    const raw = String(form.watch(name) ?? "").trim();
    return /^\d+$/.test(raw) && Number(raw) > 0
      ? `= ${formatMetres(Number(raw))} ${L.unitM}`
      : undefined;
  };
  const text = (
    name: TextName,
    opts: { required?: boolean; hint?: string; numeric?: boolean; disabled?: boolean } = {},
  ) => (
    <FormField
      id={`vt-${name}`}
      label={L.field[name]}
      required={opts.required}
      hint={
        opts.hint || metresOf(name) ? (
          <>
            {opts.hint ? <span>{opts.hint}</span> : null}
            {opts.hint && metresOf(name) ? " · " : null}
            {metresOf(name) ? <span>{metresOf(name)}</span> : null}
          </>
        ) : undefined
      }
      error={errors[name]?.message}
    >
      <TextInput
        id={`vt-${name}`}
        error={errors[name]?.message}
        disabled={opts.disabled}
        inputMode={opts.numeric ? "decimal" : undefined}
        autoComplete="off"
        className={
          opts.numeric
            ? NUM
            : name === "code"
              ? "font-[family-name:var(--font-mono)] uppercase"
              : ""
        }
        {...form.register(name)}
      />
    </FormField>
  );
  const select = (
    name: "kind" | "status",
    options: readonly string[],
    labels: Record<string, string>,
    opts: { disabled?: boolean; hint?: string } = {},
  ) => (
    <FormField
      id={`vt-${name}`}
      label={L.field[name]}
      required
      hint={opts.hint}
      error={errors[name]?.message}
    >
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          // 2–3 giá trị cố định: hiện sẵn cả hai / ba, một lần bấm (UX audit S01-6)
          <SegmentedControl
            {...fieldA11y(`vt-${name}`, errors[name]?.message, Boolean(opts.hint))}
            labelledBy={`vt-${name}-label`}
            value={field.value}
            onChange={field.onChange}
            disabled={opts.disabled}
            options={options.map((value) => ({ value, label: labels[value] ?? value }))}
          />
        )}
      />
    </FormField>
  );

  return (
    <>
      {text("code", { required: true, hint: L.form.codeHint, disabled: editing })}
      {text("name", { required: true })}
      {select("kind", VEHICLE_TYPE_KINDS, VEHICLE_TYPE_KIND_LABELS, {
        disabled: preset,
        hint: preset ? L.form.presetLockedHint : undefined,
      })}
      <div className="grid grid-cols-3 gap-3">
        {text("innerLengthMm", { required: true, numeric: true })}
        {text("innerWidthMm", { required: true, numeric: true })}
        {text("innerHeightMm", { required: true, numeric: true })}
      </div>
      <VolumePreview control={form.control} />
      <div className="grid grid-cols-2 gap-3">
        {text("maxPayloadKg", { required: true, numeric: true })}
        {text("availableCount", { required: true, numeric: true })}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {text("doorWidthMm", { numeric: true, hint: L.form.doorHint })}
        {text("doorHeightMm", { numeric: true })}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {text("gussetMm", { numeric: true, hint: L.form.gussetHint })}
        {text("rentalPrice", { numeric: true, hint: L.form.rentalHint })}
      </div>
      {editing && select("status", VEHICLE_TYPE_STATUSES, VEHICLE_TYPE_STATUS_LABELS)}
    </>
  );
}
