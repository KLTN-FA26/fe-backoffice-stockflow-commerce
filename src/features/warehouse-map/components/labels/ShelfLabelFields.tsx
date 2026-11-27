"use client";

import { Controller } from "react-hook-form";

import { UI_LABELS } from "@/constants";

import { FORM_SELECT_CLASS } from "@/components/shared/form-control-classes";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import {
  Select,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shared/combobox-select";

import { FormField } from "../shared/form-parts";

import type { UseFormReturn } from "react-hook-form";
import type {
  LayoutShelf,
  LocationLabelBody,
  LocationLabelInput,
} from "@/features/warehouse-map/types";

const P = UI_LABELS.warehouseMap.print;
/** Lớp chung của nhóm radio / checkbox trong dialog in nhãn. */
export const LABEL_LEGEND_CLASS = "text-ink-primary mb-1 text-[0.8125rem] font-medium";
export const LABEL_OPTION_CLASS = "flex items-center gap-2 text-[0.8125rem]";
export const LABEL_RADIO_CLASS = "accent-[var(--brand)]";

/** In nhãn một kệ (docs 06 §4.3 bước 1): chọn kệ, tuỳ chọn một số tầng — không chọn tầng nào = mọi tầng. */
export function ShelfLabelFields({
  form,
  shelves,
  shelfId,
}: {
  form: UseFormReturn<LocationLabelInput, unknown, LocationLabelBody>;
  /** Kệ còn trên bố cục, đã sắp theo mã. */
  shelves: readonly LayoutShelf[];
  shelfId: string;
}) {
  const errors = form.formState.errors;
  const shelf = shelves.find((item) => item.id === shelfId);
  return (
    <>
      <Controller
        control={form.control}
        name="shelfId"
        render={({ field }) => (
          <FormField id="label-shelf" label={P.shelf} required error={errors.shelfId?.message}>
            <Select
              value={field.value}
              onValueChange={(next) => {
                field.onChange(next);
                form.setValue("levelIndexes", [], { shouldValidate: true });
              }}
            >
              <SelectTrigger id="label-shelf" className={FORM_SELECT_CLASS}>
                <SelectValue placeholder={P.shelfPlaceholder} />
              </SelectTrigger>
              <TitledSelectContent title={P.shelf}>
                {shelves.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.code} — {item.name}
                  </SelectItem>
                ))}
              </TitledSelectContent>
            </Select>
          </FormField>
        )}
      />
      {shelf && shelf.levels.length > 0 && (
        <Controller
          control={form.control}
          name="levelIndexes"
          render={({ field }) => (
            <fieldset className="space-y-1.5">
              <legend className={LABEL_LEGEND_CLASS}>{P.levels}</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {[...shelf.levels]
                  .sort((a, b) => a.levelIndex - b.levelIndex)
                  .map(({ levelIndex }) => (
                    <label key={levelIndex} className={LABEL_OPTION_CLASS}>
                      <input
                        type="checkbox"
                        className={LABEL_RADIO_CLASS}
                        checked={field.value.includes(levelIndex)}
                        onChange={(event) =>
                          field.onChange(
                            event.target.checked
                              ? [...field.value, levelIndex]
                              : field.value.filter((index) => index !== levelIndex),
                          )
                        }
                      />
                      {P.level(levelIndex)}
                    </label>
                  ))}
              </div>
              <p className="text-ink-tertiary text-xs">{P.levelsHint}</p>
            </fieldset>
          )}
        />
      )}
    </>
  );
}
