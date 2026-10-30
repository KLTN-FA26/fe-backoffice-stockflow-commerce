"use client";

import { useWatch } from "react-hook-form";

import {
  BIN_NAMING_SCHEME_LABELS,
  BIN_NAMING_SCHEMES,
  BIN_TYPE_LABELS,
  BIN_TYPES,
  UI_LABELS,
} from "@/constants";
import { formatNumber } from "@/lib/format";

import { generatedBinSize } from "@/features/warehouse-map/selectors";

import { FormCheck } from "../../shared/FormCheck";
import { FormText } from "../../shared/FormText";
import { optionsOf, SelectField } from "../../shared/SelectField";
import { LocationFields } from "./LocationFields";

import type { UseFormReturn } from "react-hook-form";
import type { ShelfCreateInput, ShelfCreateValues } from "@/features/warehouse-map/types";

const E = UI_LABELS.warehouseMap.editor;
type Form = UseFormReturn<ShelfCreateInput, unknown, ShelfCreateValues>;

const positive = (raw: string) => {
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
};

/** Xem trước kích thước mỗi bin theo BR-14 (cạnh kệ ÷ số cột / hàng, làm tròn xuống mm). */
function BinSizePreview({ form }: { form: Form }) {
  const [width, length, rows, columns] = useWatch({
    control: form.control,
    name: ["width", "length", "rowCount", "columnCount"],
  }).map(positive);
  if (!width || !length || !rows || !columns) return null;
  const size = generatedBinSize(width, length, rows, columns);
  return (
    <p className="text-ink-secondary text-xs tabular-nums">
      {E.binPreview(rows, columns, formatNumber(size.width), formatNumber(size.length))}
    </p>
  );
}

/**
 * Tầng + tự sinh bin của "Thêm kệ" (docs 06 §4.1 bước 6–7): số tầng (≤ 20, BR-15), chiều cao mỗi tầng,
 * lưới hàng × cột (≤ 200 bin, BR-14), kiểu đặt mã và thuộc tính chung của mọi bin sinh ra.
 */
export function ShelfBinFields({ form }: { form: Form }) {
  const generate = useWatch({ control: form.control, name: "generateBins" });
  return (
    <fieldset className="border-border-default space-y-3 rounded-(--r-sm) border p-3">
      <div className="grid grid-cols-2 gap-3">
        <FormText
          form={form}
          name="levelCount"
          id="shelf-levelCount"
          label={E.levelCount}
          required
          kind="numeric"
        />
        <FormText
          form={form}
          name="levelHeight"
          id="shelf-levelHeight"
          label={E.levelHeight}
          required
          kind="numeric"
        />
      </div>
      <FormCheck control={form.control} name="generateBins" label={E.generateBins} />
      {generate && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <FormText
              form={form}
              name="rowCount"
              id="shelf-rows"
              label={E.rowCount}
              required
              kind="numeric"
            />
            <FormText
              form={form}
              name="columnCount"
              id="shelf-columns"
              label={E.columnCount}
              required
              kind="numeric"
            />
            <div className="col-span-2">
              <SelectField
                control={form.control}
                name="namingScheme"
                id="shelf-naming"
                label={E.namingScheme}
                options={optionsOf(BIN_NAMING_SCHEMES, BIN_NAMING_SCHEME_LABELS)}
              />
            </div>
          </div>
          <BinSizePreview form={form} />
          <SelectField
            control={form.control}
            name="binType"
            id="shelf-binType"
            label={E.binType}
            options={optionsOf(BIN_TYPES, BIN_TYPE_LABELS)}
          />
          <LocationFields form={form} idPrefix="shelf" />
        </>
      )}
    </fieldset>
  );
}
