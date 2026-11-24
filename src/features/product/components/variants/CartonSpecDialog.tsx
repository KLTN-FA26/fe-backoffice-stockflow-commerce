"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { UI_LABELS } from "@/constants";
import { CheckboxField } from "@/components/shared/CheckboxField";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { cartonSaveError } from "../../carton-errors";
import { useSaveCartonSpec } from "../../carton-queries";
import { cartonFormValuesOf, cartonSpecFormSchema } from "../../carton-schemas";
import { ProductInput } from "../form-controls";
import { Field } from "./Field";

import type { CartonSpecFormValues, UomConversion } from "../../carton-schemas";

const L = UI_LABELS.cartonSpec.dialog;
const MEASURES = ["lengthCm", "widthCm", "heightCm", "weightKg"] as const;
const isFormField = (name: string): name is keyof CartonSpecFormValues =>
  name in cartonFormValuesOf(null);

/**
 * Khai báo (`carton` null) hoặc sửa đơn vị thùng của SKU — BE `POST/PUT .../uom-conversions`. Quyền và
 * trạng thái do panel xét (`product-products:UPDATE`, sản phẩm nhận thay đổi, biến thể chưa ngừng);
 * UI-only — Backend phải re-check.
 */
export function CartonSpecDialog({
  productId,
  variantId,
  carton,
  open,
  onOpenChange,
}: {
  productId: string;
  variantId: string;
  carton: UomConversion | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <CartonSpecForm
          productId={productId}
          variantId={variantId}
          carton={carton}
          onDone={() => onOpenChange(false)}
        />
      )}
    </FormDialog>
  );
}

function CartonSpecForm({
  productId,
  variantId,
  carton,
  onDone,
}: {
  productId: string;
  variantId: string;
  carton: UomConversion | null;
  onDone: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const save = useSaveCartonSpec();
  const form = useForm<CartonSpecFormValues>({
    resolver: zodResolver(cartonSpecFormSchema),
    mode: "onChange",
    defaultValues: cartonFormValuesOf(carton),
  });
  const { errors, isValid } = form.formState;

  const submit = form.handleSubmit((values) => {
    setError(null);
    save.mutate(
      { productId, variantId, carton, values },
      {
        onSuccess: onDone,
        onError: (e) => {
          const { fields, message } = cartonSaveError(e);
          for (const [name, text] of Object.entries(fields)) {
            if (isFormField(name)) form.setError(name, { message: text });
          }
          setError(message);
        },
      },
    );
  });

  return (
    <FormDialogBody
      title={carton ? L.editTitle(carton.unitOfMeasure) : L.createTitle}
      description={L.description}
      submitLabel={carton ? L.submitEdit : L.submitCreate}
      canSubmit={isValid}
      isPending={save.isPending}
      error={error}
      onSubmit={() => void submit()}
      onCancel={onDone}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field
          label={L.unitOfMeasure}
          id="carton-unit"
          hint={L.unitOfMeasureHint}
          error={errors.unitOfMeasure?.message}
        >
          <ProductInput
            id="carton-unit"
            {...form.register("unitOfMeasure", {
              // BE chỉ nhận chữ in hoa: đổi thật sang chữ hoa (class `uppercase` chỉ đổi cách hiển thị).
              setValueAs: (value: string) => value.toUpperCase(),
            })}
            className="font-[family-name:var(--font-mono)] uppercase"
          />
        </Field>
        <Field label={L.unitsPerCarton} id="carton-units" error={errors.unitsPerCarton?.message}>
          <ProductInput
            id="carton-units"
            inputMode="numeric"
            {...form.register("unitsPerCarton")}
            className="text-right tabular-nums"
            autoFocus
          />
        </Field>
        {MEASURES.map((name) => (
          <Field key={name} label={L[name]} id={`carton-${name}`} error={errors[name]?.message}>
            <ProductInput
              id={`carton-${name}`}
              inputMode="decimal"
              {...form.register(name)}
              className="text-right tabular-nums"
            />
          </Field>
        ))}
      </div>
      <p className="text-ink-tertiary text-xs">{L.measuresHint}</p>
      <CheckboxField control={form.control} name="defaultShipping" label={L.defaultShipping} />
      {errors.defaultShipping?.message && (
        <p className="text-danger text-xs">{errors.defaultShipping.message}</p>
      )}
    </FormDialogBody>
  );
}
