"use client";

import { STORAGE_CLASS_LABELS, STORAGE_CLASSES, UI_LABELS } from "@/constants";

import { FormCheck } from "../../shared/FormCheck";
import { FormText } from "../../shared/FormText";
import { optionsOf, SelectField } from "../../shared/SelectField";

import type { FieldPath, FieldPathByValue, FieldValues, UseFormReturn } from "react-hook-form";

const E = UI_LABELS.warehouseMap.editor;

/**
 * Thuộc tính vị trí tồn kho (docs 06 §1 "Thuộc tính chung"): sức chứa, tải trọng (trống = không kiểm),
 * cho phép lấy / cất. `storageClassName` có khi là khu vực (bin dùng lớp mặc định của kệ).
 */
export function LocationFields<TIn extends FieldValues, TOut extends FieldValues>({
  form,
  idPrefix,
  storageClassName,
}: {
  form: UseFormReturn<TIn, unknown, TOut>;
  idPrefix: string;
  storageClassName?: FieldPath<TIn>;
}) {
  // Form kệ / khu vực đều có các khoá này (input-schemas-layout `locationFields`)
  const name = (key: "capacityUnits" | "maxWeight") => key as FieldPath<TIn>;
  const flag = (key: "pickable" | "putawayTarget") => key as FieldPathByValue<TIn, boolean>;
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {storageClassName && (
          <SelectField
            control={form.control}
            name={storageClassName}
            id={`${idPrefix}-storageClass`}
            label={UI_LABELS.warehouseMap.panel.storageClass}
            options={optionsOf(STORAGE_CLASSES, STORAGE_CLASS_LABELS)}
          />
        )}
        <FormText
          form={form}
          name={name("capacityUnits")}
          id={`${idPrefix}-capacity`}
          label={E.capacityUnits}
          kind="numeric"
        />
        <FormText
          form={form}
          name={name("maxWeight")}
          id={`${idPrefix}-maxWeight`}
          label={E.maxWeight}
          kind="numeric"
        />
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <FormCheck control={form.control} name={flag("pickable")} label={E.pickable} />
        <FormCheck control={form.control} name={flag("putawayTarget")} label={E.putawayTarget} />
      </div>
    </>
  );
}
