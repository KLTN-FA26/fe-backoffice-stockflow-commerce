"use client";

import { UI_LABELS } from "@/constants";

import { FormCheck } from "../../shared/FormCheck";
import { FormText } from "../../shared/FormText";
import { SelectField } from "../../shared/SelectField";

import type { FieldPath, FieldPathByValue, FieldValues, UseFormReturn } from "react-hook-form";

const E = UI_LABELS.warehouseMap.editor;
/** BR-09 (docs 06 §6): chỉ 0 / 90 / 180 / 270 độ. */
const ROTATION_OPTIONS = ["0", "90", "180", "270"].map((value) => ({ value, label: `${value}°` }));

type PlacementKey = "x" | "y" | "width" | "length" | "rotation";

/**
 * Vị trí + kích thước + góc xoay + vật cản — dùng chung cho kệ và khu vực (BE `FootprintRequest`).
 * Lỗi BR-06 / BR-07 (ngoài khung, chồng lấn) gắn ở ô X.
 */
export function PlacementFields<TIn extends FieldValues, TOut extends FieldValues>({
  form,
  idPrefix,
}: {
  form: UseFormReturn<TIn, unknown, TOut>;
  idPrefix: string;
}) {
  // Form kệ / khu vực đều có các khoá này (input-schemas-layout `placement`)
  const field = (key: PlacementKey) => key as FieldPath<TIn>;
  const text = (key: Exclude<PlacementKey, "rotation">) => (
    <FormText
      form={form}
      name={field(key)}
      id={`${idPrefix}-${key}`}
      label={E[key]}
      required
      kind="numeric"
    />
  );
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {text("x")}
        {text("y")}
        {text("width")}
        {text("length")}
      </div>
      <div className="grid grid-cols-2 items-end gap-3">
        <SelectField
          control={form.control}
          name={field("rotation")}
          id={`${idPrefix}-rotation`}
          label={E.rotation}
          options={ROTATION_OPTIONS}
        />
        <FormCheck
          control={form.control}
          name={"obstacle" as FieldPathByValue<TIn, boolean>}
          label={E.obstacle}
          className="pb-2"
        />
      </div>
    </>
  );
}
