"use client";

import { useState } from "react";

import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { attributeErrorMessage } from "../attribute-errors";
import { useAddAttributeValue, useUpdateAttributeValue } from "../attribute-queries";
import { attributeValueFormSchemaFor } from "../attribute-schemas";
import { ProductInput } from "./form-controls";
import { Field } from "./variants/Field";

import type { Attribute, AttributeValue, AttributeValueFormValues } from "../attribute-schemas";

/**
 * Thêm hoặc sửa một giá trị của thuộc tính (BE `POST/PUT /attributes/{id}/values[/{valueId}]`). Giá trị
 * màu bắt buộc có mã #RRGGBB; loại khác không có màu. Mã cố định sau khi tạo; sửa gửi `version` của
 * giá trị. Giá trị là một phần của thuộc tính nên cùng quyền sửa thuộc tính.
 */
export function AttributeValueFormDialog({
  attribute,
  value,
  open,
  onOpenChange,
}: {
  attribute: Attribute;
  value?: AttributeValue;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange}>
      {open && <Form attribute={attribute} value={value} onDone={() => onOpenChange(false)} />}
    </FormDialog>
  );
}

function Form({
  attribute,
  value,
  onDone,
}: {
  attribute: Attribute;
  value?: AttributeValue;
  onDone: () => void;
}) {
  const isColor = attribute.dataType === "COLOR";
  const [values, setValues] = useState<AttributeValueFormValues>(() => ({
    code: value?.code ?? "",
    label: value?.label ?? "",
    valueNumber: value?.valueNumber == null ? "" : String(value.valueNumber),
    hexColor: value?.hexColor ?? (isColor ? "#000000" : ""),
    sortOrder: value ? String(value.sortOrder) : "",
    active: value?.active ?? true,
  }));
  const [error, setError] = useState<string | null>(null);
  const add = useAddAttributeValue();
  const update = useUpdateAttributeValue();
  const parsed = attributeValueFormSchemaFor(attribute.dataType).safeParse(values);
  const issueOf = (field: keyof AttributeValueFormValues) =>
    parsed.success ? undefined : parsed.error.issues.find((i) => i.path[0] === field)?.message;
  const set =
    (field: "code" | "label" | "valueNumber" | "hexColor" | "sortOrder") =>
    (e: { target: { value: string } }) =>
      setValues((v) => ({ ...v, [field]: e.target.value }));

  const submit = () => {
    if (!parsed.success) return;
    setError(null);
    const handlers = {
      onSuccess: onDone,
      onError: (e: unknown) => setError(attributeErrorMessage(e, "value")),
    };
    if (value)
      update.mutate(
        {
          attributeId: attribute.attributeId,
          valueId: value.valueId,
          version: value.version,
          values: parsed.data,
        },
        handlers,
      );
    else add.mutate({ attributeId: attribute.attributeId, values: parsed.data }, handlers);
  };

  return (
    <FormDialogBody
      title={value ? `Sửa giá trị ${value.code}` : `Thêm giá trị cho ${attribute.name}`}
      description={
        isColor
          ? "Giá trị màu cần mã màu dạng #RRGGBB. Mã giá trị viết hoa, dùng để sinh SKU."
          : "Mã giá trị viết hoa (chữ, số, '_' và '-'), dùng để sinh SKU của biến thể."
      }
      submitLabel={value ? "Lưu" : "Thêm giá trị"}
      canSubmit={parsed.success}
      isPending={add.isPending || update.isPending}
      error={error}
      onSubmit={submit}
      onCancel={onDone}
    >
      <Field label="Mã *" id="value-code" error={values.code ? issueOf("code") : undefined}>
        <ProductInput
          id="value-code"
          value={values.code}
          onChange={set("code")}
          disabled={Boolean(value)}
          className="font-[family-name:var(--font-mono)] uppercase"
          autoFocus={!value}
        />
      </Field>
      <Field label="Nhãn *" id="value-label" error={values.label ? issueOf("label") : undefined}>
        <ProductInput id="value-label" value={values.label} onChange={set("label")} />
      </Field>
      {isColor && (
        <Field label="Màu *" id="value-hex" error={issueOf("hexColor")}>
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Chọn màu"
              value={/^#[0-9A-Fa-f]{6}$/.test(values.hexColor) ? values.hexColor : "#000000"}
              onChange={(e) => setValues((v) => ({ ...v, hexColor: e.target.value.toUpperCase() }))}
              className="border-border-default h-8 w-10 cursor-pointer rounded border"
            />
            <ProductInput
              id="value-hex"
              value={values.hexColor}
              onChange={set("hexColor")}
              className="font-[family-name:var(--font-mono)] uppercase"
            />
          </div>
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Giá trị số" id="value-number" hint="Tuỳ chọn" error={issueOf("valueNumber")}>
          <ProductInput
            id="value-number"
            inputMode="decimal"
            value={values.valueNumber}
            onChange={set("valueNumber")}
            className="text-right tabular-nums"
          />
        </Field>
        <Field label="Thứ tự" id="value-sort" hint="Trống = 0" error={issueOf("sortOrder")}>
          <ProductInput
            id="value-sort"
            inputMode="numeric"
            value={values.sortOrder}
            onChange={set("sortOrder")}
            className="text-right tabular-nums"
          />
        </Field>
      </div>
      {value && (
        <label className="text-ink-secondary flex items-center gap-2 text-xs font-medium">
          <input
            type="checkbox"
            checked={values.active}
            onChange={(e) => setValues((v) => ({ ...v, active: e.target.checked }))}
            className="accent-brand size-4"
          />
          Đang dùng (giá trị bị vô hiệu không chọn mới được)
        </label>
      )}
    </FormDialogBody>
  );
}
