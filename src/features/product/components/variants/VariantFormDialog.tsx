"use client";

import { useMemo, useState } from "react";

import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { variantErrorMessage } from "../../variant-errors";
import { useAddVariant, useProductAxes, useUpdateVariant } from "../../variant-queries";
import { variantInputSchemaFor } from "../../variant-schemas";
import { Field } from "./Field";

import type { ProductAxis, Variant } from "../../variant-schemas";

/**
 * Thêm biến thể (`variant` trống) hoặc sửa biến thể có sẵn — BE `VariantRequest`.
 * Sản phẩm có trục (màu, cỡ…): mỗi trục một ô chọn → `optionValueIds`; SKU / tên tuỳ chọn (BE sinh).
 * Sản phẩm không có trục: nhập SKU và tên.
 */
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
  const axesQuery = useProductAxes(productId);
  const axes = useMemo<ProductAxis[]>(() => axesQuery.data ?? [], [axesQuery.data]);
  const hasAxes = axes.length > 0;
  const [values, setValues] = useState({ sku: variant?.sku ?? "", name: variant?.name ?? "" });
  // attributeId → valueId đang chọn; khởi tạo từ tuỳ chọn hiện có của biến thể khi sửa.
  const [selected, setSelected] = useState<Record<string, string>>(() =>
    Object.fromEntries((variant?.options ?? []).map((o) => [o.attributeId, o.valueId])),
  );
  const [error, setError] = useState<string | null>(null);
  const add = useAddVariant();
  const update = useUpdateVariant();

  // BE: SKU và tuỳ chọn cố định khi biến thể đã rời DRAFT.
  const locked = Boolean(variant && variant.status !== "DRAFT");
  // Biến thể đã rời DRAFT mà chưa có tuỳ chọn thì không gán thêm được nữa (BE từ chối) — bỏ qua trục.
  const optionAxes = locked && (variant?.options.length ?? 0) === 0 ? [] : axes;
  const optionValueIds = optionAxes.map((axis) => selected[axis.attributeId]).filter(Boolean);
  const parsed = variantInputSchemaFor(optionAxes.length).safeParse({ ...values, optionValueIds });
  const issueOf = (field: "sku" | "name") =>
    parsed.success ? undefined : parsed.error.issues.find((i) => i.path[0] === field)?.message;
  const set = (field: "sku" | "name") => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [field]: e.target.value }));
  const axesReady = axesQuery.isSuccess;

  const submit = () => {
    if (!parsed.success || !axesReady) return;
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
          ? "Đổi tên, mã SKU hoặc tuỳ chọn. Mã SKU và tuỳ chọn chỉ đổi được khi biến thể còn Nháp."
          : "Biến thể mới ở trạng thái Nháp; kho tạo sẵn mục tồn kho cho SKU này."
      }
      submitLabel={variant ? "Lưu" : "Thêm biến thể"}
      canSubmit={parsed.success && axesReady}
      isPending={add.isPending || update.isPending}
      error={error}
      onSubmit={submit}
      onCancel={onDone}
    >
      {axesQuery.isLoading && (
        <p className="text-ink-tertiary text-xs">Đang tải thuộc tính của sản phẩm…</p>
      )}
      {axesQuery.isError && (
        <p role="alert" className="text-danger text-xs">
          Không tải được thuộc tính của sản phẩm nên chưa thể thêm hoặc sửa biến thể. Hãy đóng và
          thử lại.
        </p>
      )}
      {optionAxes.map((axis) => {
        const id = `variant-axis-${axis.attributeId}`;
        const current = selected[axis.attributeId];
        return (
          <Field key={axis.attributeId} label={`${axis.name} *`} id={id}>
            <Select
              value={current ?? ""}
              onValueChange={(valueId) =>
                setSelected((prev) => ({ ...prev, [axis.attributeId]: valueId }))
              }
              disabled={locked}
            >
              <SelectTrigger id={id} className="w-full">
                <SelectValue placeholder={`Chọn ${axis.name.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {axis.options
                  // Giá trị đã bị vô hiệu trong từ điển: chỉ biến thể đang mang nó mới còn thấy.
                  .filter((option) => option.active || option.valueId === current)
                  .map((option) => (
                    <SelectItem key={option.valueId} value={option.valueId}>
                      {option.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
        );
      })}
      <Field
        label={hasAxes ? "Mã SKU" : "Mã SKU *"}
        id="variant-sku"
        hint={
          hasAxes
            ? "Bỏ trống: hệ thống tự sinh theo mã sản phẩm và các tuỳ chọn đã chọn."
            : undefined
        }
        error={values.sku ? issueOf("sku") : undefined}
      >
        <Input
          id="variant-sku"
          value={values.sku}
          onChange={set("sku")}
          disabled={locked}
          className="font-[family-name:var(--font-mono)] uppercase"
          autoFocus={!variant && !hasAxes}
        />
      </Field>
      <Field
        label={hasAxes ? "Tên biến thể" : "Tên biến thể *"}
        id="variant-name"
        hint={
          hasAxes
            ? "Bỏ trống: hệ thống tự đặt theo tên sản phẩm và các tuỳ chọn đã chọn."
            : undefined
        }
        error={values.name ? issueOf("name") : undefined}
      >
        <Input id="variant-name" value={values.name} onChange={set("name")} />
      </Field>
    </FormDialogBody>
  );
}
