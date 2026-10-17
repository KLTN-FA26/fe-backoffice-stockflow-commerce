"use client";

import { useState } from "react";

import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { attributeErrorMessage } from "../attribute-errors";
import { DATA_TYPE_LABEL } from "../attribute-labels";
import { useCreateAttribute, useUpdateAttribute } from "../attribute-queries";
import { ATTRIBUTE_DATA_TYPES, attributeFormSchema } from "../attribute-schemas";
import { Field } from "./variants/Field";

import type { Attribute, AttributeDataType, AttributeFormValues } from "../attribute-schemas";

/**
 * Tạo hoặc sửa một thuộc tính của từ điển (BE `POST /attributes`, `PUT /attributes/{id}`). Mã và loại
 * cố định sau khi tạo; sửa gửi `version` của lần đọc (409 OPTIMISTIC_LOCK nếu đã đổi) và `active` —
 * vô hiệu hoá là cách ngừng dùng một thuộc tính đang được sản phẩm sử dụng.
 */
export function AttributeFormDialog({
  attribute,
  open,
  onOpenChange,
  onSaved,
}: {
  attribute?: Attribute;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (attribute: Attribute) => void;
}) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange}>
      {open && <Form attribute={attribute} onDone={() => onOpenChange(false)} onSaved={onSaved} />}
    </FormDialog>
  );
}

const EMPTY: AttributeFormValues = {
  code: "",
  dataType: "SELECT",
  name: "",
  unit: "",
  filterable: true,
  searchable: false,
  sortOrder: "",
  active: true,
};

function Form({
  attribute,
  onDone,
  onSaved,
}: {
  attribute?: Attribute;
  onDone: () => void;
  onSaved?: (attribute: Attribute) => void;
}) {
  const [values, setValues] = useState<AttributeFormValues>(() =>
    attribute
      ? {
          code: attribute.code,
          dataType: attribute.dataType,
          name: attribute.name,
          unit: attribute.unit ?? "",
          filterable: attribute.filterable,
          searchable: attribute.searchable,
          sortOrder: String(attribute.sortOrder),
          active: attribute.active,
        }
      : EMPTY,
  );
  const [error, setError] = useState<string | null>(null);
  const create = useCreateAttribute();
  const update = useUpdateAttribute();
  const parsed = attributeFormSchema.safeParse(values);
  const issueOf = (field: keyof AttributeFormValues) =>
    parsed.success ? undefined : parsed.error.issues.find((i) => i.path[0] === field)?.message;
  const text =
    (field: "code" | "name" | "unit" | "sortOrder") => (e: { target: { value: string } }) =>
      setValues((v) => ({ ...v, [field]: e.target.value }));

  const submit = () => {
    if (!parsed.success) return;
    setError(null);
    const handlers = {
      onSuccess: (saved: Attribute) => {
        onSaved?.(saved);
        onDone();
      },
      onError: (e: unknown) => setError(attributeErrorMessage(e, "save")),
    };
    if (attribute)
      update.mutate(
        { attributeId: attribute.attributeId, version: attribute.version, values: parsed.data },
        handlers,
      );
    else create.mutate(parsed.data, handlers);
  };

  return (
    <FormDialogBody
      title={attribute ? `Sửa thuộc tính ${attribute.code}` : "Thêm thuộc tính"}
      description={
        attribute
          ? "Mã và loại không đổi được sau khi tạo. Vô hiệu hoá để ngừng dùng thuộc tính mà không xoá."
          : "Thuộc tính dùng làm trục biến thể (màu, cỡ…) hoặc mô tả sản phẩm. Mã viết hoa, chỉ gồm chữ, số và '_'."
      }
      submitLabel={attribute ? "Lưu" : "Thêm thuộc tính"}
      canSubmit={parsed.success}
      isPending={create.isPending || update.isPending}
      error={error}
      onSubmit={submit}
      onCancel={onDone}
    >
      <Field label="Mã *" id="attr-code" error={values.code ? issueOf("code") : undefined}>
        <Input
          id="attr-code"
          value={values.code}
          onChange={text("code")}
          disabled={Boolean(attribute)}
          className="font-[family-name:var(--font-mono)] uppercase"
          autoFocus={!attribute}
        />
      </Field>
      <Field label="Loại *" id="attr-type">
        <Select
          value={values.dataType}
          onValueChange={(v) => setValues((s) => ({ ...s, dataType: v as AttributeDataType }))}
          disabled={Boolean(attribute)}
        >
          <SelectTrigger id="attr-type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ATTRIBUTE_DATA_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {DATA_TYPE_LABEL[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Tên *" id="attr-name" error={values.name ? issueOf("name") : undefined}>
        <Input id="attr-name" value={values.name} onChange={text("name")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Đơn vị" id="attr-unit" error={issueOf("unit")}>
          <Input id="attr-unit" value={values.unit} onChange={text("unit")} />
        </Field>
        <Field label="Thứ tự" id="attr-sort" hint="Trống = 0" error={issueOf("sortOrder")}>
          <Input
            id="attr-sort"
            inputMode="numeric"
            value={values.sortOrder}
            onChange={text("sortOrder")}
            className="text-right tabular-nums"
          />
        </Field>
      </div>
      {(
        [
          ["filterable", "Cho phép lọc trên cửa hàng"],
          ["searchable", "Đưa vào tìm kiếm"],
          ...(attribute ? ([["active", "Đang dùng"]] as const) : []),
        ] as const
      ).map(([field, label]) => (
        <label
          key={field}
          className="text-ink-secondary flex items-center gap-2 text-xs font-medium"
        >
          <input
            type="checkbox"
            checked={values[field]}
            onChange={(e) => setValues((v) => ({ ...v, [field]: e.target.checked }))}
            className="accent-brand size-4"
          />
          {label}
        </label>
      ))}
    </FormDialogBody>
  );
}
