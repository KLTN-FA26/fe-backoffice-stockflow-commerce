"use client";

import { useState } from "react";

import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { Input } from "@/components/ui/input";

import { variantErrorMessage } from "../../variant-errors";
import { useAddVariant, useUpdateVariant } from "../../variant-queries";
import { variantInputSchema } from "../../variant-schemas";
import { Field } from "./Field";

import type { Variant, VariantInput } from "../../variant-schemas";

/** Thêm biến thể (`variant` trống) hoặc sửa biến thể có sẵn — BE `VariantRequest`. */
export function VariantFormDialog({
  productId,
  variant,
  open,
  onOpenChange,
}: {
  productId: string;
  variant?: Variant;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <VariantForm productId={productId} variant={variant} onDone={() => onOpenChange(false)} />
      )}
    </FormDialog>
  );
}

function VariantForm({
  productId,
  variant,
  onDone,
}: {
  productId: string;
  variant?: Variant;
  onDone: () => void;
}) {
  const [values, setValues] = useState<VariantInput>({
    sku: variant?.sku ?? "",
    name: variant?.name ?? "",
    attributeSignature: variant?.attributeSignature ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const add = useAddVariant();
  const update = useUpdateVariant();
  const parsed = variantInputSchema.safeParse(values);
  const issueOf = (field: keyof VariantInput) =>
    parsed.success ? undefined : parsed.error.issues.find((i) => i.path[0] === field)?.message;
  // BE: SKU cố định khi biến thể đã rời DRAFT.
  const skuLocked = Boolean(variant && variant.status !== "DRAFT");
  const set = (field: keyof VariantInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [field]: e.target.value }));

  const submit = () => {
    if (!parsed.success) return;
    setError(null);
    const onError = (e: unknown) => setError(variantErrorMessage(e, "save"));
    if (variant) {
      update.mutate(
        { productId, variantId: variant.variantId, position: variant.position, ...parsed.data },
        { onSuccess: onDone, onError },
      );
    } else {
      add.mutate({ productId, ...parsed.data }, { onSuccess: onDone, onError });
    }
  };

  return (
    <FormDialogBody
      title={variant ? `Sửa biến thể ${variant.sku}` : "Thêm biến thể"}
      description={
        variant
          ? "Đổi tên hoặc tổ hợp thuộc tính. Mã SKU chỉ đổi được khi biến thể còn Nháp."
          : "Biến thể mới ở trạng thái Nháp; kho tạo sẵn mục tồn kho cho SKU này."
      }
      submitLabel={variant ? "Lưu" : "Thêm biến thể"}
      canSubmit={parsed.success}
      isPending={add.isPending || update.isPending}
      error={error}
      onSubmit={submit}
      onCancel={onDone}
    >
      <Field label="Mã SKU *" id="variant-sku" error={values.sku ? issueOf("sku") : undefined}>
        <Input
          id="variant-sku"
          value={values.sku}
          onChange={set("sku")}
          disabled={skuLocked}
          className="font-[family-name:var(--font-mono)] uppercase"
          autoFocus={!variant}
        />
      </Field>
      <Field
        label="Tên biến thể *"
        id="variant-name"
        error={values.name ? issueOf("name") : undefined}
      >
        <Input id="variant-name" value={values.name} onChange={set("name")} />
      </Field>
      <Field
        label="Tổ hợp thuộc tính"
        id="variant-signature"
        hint="Ví dụ COLOR=WHITE;SIZE=12OZ — không trùng trong sản phẩm. Để trống: SKU=<mã SKU>."
        error={issueOf("attributeSignature")}
      >
        <Input
          id="variant-signature"
          value={values.attributeSignature}
          onChange={set("attributeSignature")}
          className="font-[family-name:var(--font-mono)]"
        />
      </Field>
    </FormDialogBody>
  );
}
