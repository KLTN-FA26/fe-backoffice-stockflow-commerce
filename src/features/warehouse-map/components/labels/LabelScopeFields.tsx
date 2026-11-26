"use client";

import { Controller } from "react-hook-form";

import {
  CARTON_LABEL_FORMAT_LABELS,
  CARTON_LABEL_FORMATS,
  LOCATION_LABEL_SCOPES,
  LOCATION_STATUS,
  UI_LABELS,
} from "@/constants";

import { labelSelectionOf } from "@/features/warehouse-map/location-label-schema";
import { printableLabelCodes } from "@/features/warehouse-map/location-labels";

import { FORM_SELECT_CLASS, FORM_TEXTAREA_CLASS } from "@/components/shared/form-control-classes";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/shared/combobox-select";
import { Textarea } from "@/components/ui/textarea";

import { FieldError, FormField } from "../shared/form-parts";
import {
  LABEL_LEGEND_CLASS as LEGEND,
  LABEL_OPTION_CLASS as OPTION,
  LABEL_RADIO_CLASS as RADIO,
  ShelfLabelFields,
} from "./ShelfLabelFields";

import type { UseFormReturn } from "react-hook-form";
import type {
  LocationLabelBody,
  LocationLabelInput,
  WarehouseLayout,
} from "@/features/warehouse-map/types";

const P = UI_LABELS.warehouseMap.print;

/**
 * Các ô của dialog in nhãn: phạm vi (đúng một — docs 06 §4.3 bước 1), ô của phạm vi đó, khổ nhãn, và số nhãn sẽ in tính
 * trên bố cục đã tải (BR-17 — chặn trước khi vượt 2.000). Kệ ngừng dùng không có trong danh sách chọn (bin của nó bị bỏ).
 */
export function LabelScopeFields({
  form,
  layout,
  disabled,
}: {
  form: UseFormReturn<LocationLabelInput, unknown, LocationLabelBody>;
  layout: WarehouseLayout;
  disabled: boolean;
}) {
  const value = form.watch();
  const errors = form.formState.errors;
  const shelves = layout.shelves
    .filter((shelf) => shelf.status !== LOCATION_STATUS.INACTIVE)
    .sort((a, b) => a.code.localeCompare(b.code));
  const zones = [...layout.zones].sort((a, b) => a.name.localeCompare(b.name, "vi"));
  const count = printableLabelCodes(layout, labelSelectionOf(value)).length;

  return (
    <fieldset disabled={disabled} className="m-0 min-w-0 space-y-3 border-0 p-0">
      <fieldset className="space-y-1.5">
        <legend className={LEGEND}>{P.scope}</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {LOCATION_LABEL_SCOPES.map((scope) => (
            <label key={scope} className={OPTION}>
              <input type="radio" value={scope} className={RADIO} {...form.register("scope")} />
              {P.scopes[scope]}
            </label>
          ))}
        </div>
        <FieldError>{errors.scope?.message}</FieldError>
      </fieldset>

      {value.scope === "SHELF" && (
        <ShelfLabelFields form={form} shelves={shelves} shelfId={value.shelfId} />
      )}

      {value.scope === "ZONE" && (
        <Controller
          control={form.control}
          name="zoneId"
          render={({ field }) => (
            <FormField
              id="label-zone"
              label={P.zone}
              required
              hint={P.zoneHint}
              error={errors.zoneId?.message}
            >
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="label-zone" className={FORM_SELECT_CLASS}>
                  <SelectValue placeholder={P.zonePlaceholder} />
                </SelectTrigger>
                <TitledSelectContent title={P.zone}>
                  {zones.map((zone) => (
                    <SelectItem key={zone.id} value={zone.id}>
                      {zone.name}
                    </SelectItem>
                  ))}
                </TitledSelectContent>
              </Select>
            </FormField>
          )}
        />
      )}

      {value.scope === "CODES" && (
        <FormField
          id="label-codes"
          label={P.codes}
          required
          hint={P.codesHint}
          error={errors.codesText?.message}
        >
          <Textarea
            id="label-codes"
            rows={5}
            placeholder={P.codesPlaceholder}
            aria-invalid={errors.codesText ? true : undefined}
            aria-describedby={errors.codesText ? "label-codes-error" : undefined}
            className={`${FORM_TEXTAREA_CLASS} font-mono`}
            {...form.register("codesText")}
          />
        </FormField>
      )}

      <fieldset className="space-y-1.5">
        <legend className={LEGEND}>{P.format}</legend>
        {CARTON_LABEL_FORMATS.map((format) => (
          <label key={format} className={OPTION}>
            <input type="radio" value={format} className={RADIO} {...form.register("format")} />
            {CARTON_LABEL_FORMAT_LABELS[format]}
          </label>
        ))}
      </fieldset>

      <p aria-live="polite" className="text-ink-secondary text-xs tabular-nums">
        {P.count(count)}
      </p>
    </fieldset>
  );
}
