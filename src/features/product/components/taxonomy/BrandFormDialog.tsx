"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { PRODUCT_PERMISSIONS, UI_LABELS } from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { toast } from "@/components/shared/Toast";
import { FORM_INPUT_CLASS } from "@/components/shared/form-control-classes";
import { Input } from "@/components/ui/input";

import { makeBrandFormSchema } from "../../taxonomy-input-schemas";
import { isStaleTaxonomyError, taxonomyFormError } from "../../taxonomy-errors";
import { useCreateBrand, useUpdateBrand } from "../../taxonomy-mutations";
import { Field } from "../variants/Field";
import { CheckboxField } from "./form-parts";
import { UrlPreviewThumb } from "./TaxonomyThumb";

import type { BrandFormValues } from "../../taxonomy-input-schemas";
import type { Brand } from "../../taxonomy-schemas";

const L = UI_LABELS.taxonomy;
const BRAND_FIELDS: readonly string[] = [
  "code",
  "name",
  "logoUrl",
] satisfies (keyof BrandFormValues)[];
const isBrandField = (field: string | undefined): field is "code" | "name" | "logoUrl" =>
  field !== undefined && BRAND_FIELDS.includes(field);

/** Tạo (`brand` trống) / sửa / xem thương hiệu — mã bất biến, không xoá (ngưng dùng thay thế). */
export function BrandFormDialog({
  brand,
  open,
  onOpenChange,
}: {
  brand?: Brand;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange}>
      {open && <BrandForm brand={brand} onDone={() => onOpenChange(false)} />}
    </FormDialog>
  );
}

function BrandForm({ brand, onDone }: { brand?: Brand; onDone: () => void }) {
  const can = usePermissionChecker();
  const mode = brand ? "edit" : "create";
  // UI-only — Backend phải re-check (@RequiresPermission product-products:UPDATE)
  const readOnly = Boolean(brand) && !can(PRODUCT_PERMISSIONS.update);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<BrandFormValues>({
    resolver: zodResolver(makeBrandFormSchema(mode)),
    mode: "onChange",
    defaultValues: {
      code: brand?.code ?? "",
      name: brand?.name ?? "",
      logoUrl: brand?.logoUrl ?? "",
      active: brand?.active ?? true,
    },
  });
  const logoUrl = useWatch({ control: form.control, name: "logoUrl" });
  const name = useWatch({ control: form.control, name: "name" });
  const create = useCreateBrand();
  const update = useUpdateBrand();
  const { errors, isValid } = form.formState;

  const submit = form.handleSubmit((values) => {
    setError(null);
    const onError = (e: unknown) => {
      const { field, message } = taxonomyFormError(e, mode);
      // Bản ghi đã bị sửa / không còn: danh sách vừa tải lại → đóng dialog và báo bằng toast. Không
      // để người dùng bấm Lưu lại trên dữ liệu cũ — PUT của BE không có version nên sẽ ghi đè.
      if (brand && isStaleTaxonomyError(e)) {
        toast.error(L.staleTitle, message);
        onDone();
        return;
      }
      if (isBrandField(field)) form.setError(field, { message });
      else setError(message);
    };
    if (brand) {
      update.mutate({ brandId: brand.brandId, values }, { onSuccess: onDone, onError });
    } else {
      create.mutate(values, { onSuccess: onDone, onError });
    }
  });

  return (
    <FormDialogBody
      title={
        !brand ? L.createBrand : `${readOnly ? L.brandTitle : "Sửa thương hiệu"} ${brand.code}`
      }
      description={!brand ? L.codeHint : readOnly ? L.readOnlyHint : L.lockedHint}
      submitLabel={brand ? "Lưu" : L.createBrand}
      canSubmit={isValid}
      isPending={create.isPending || update.isPending}
      error={error}
      readOnly={readOnly}
      onSubmit={() => void submit()}
      onCancel={onDone}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3">
        <Field label={`${L.field.code} *`} id="brand-code" error={errors.code?.message}>
          <Input
            id="brand-code"
            {...form.register("code")}
            disabled={Boolean(brand)}
            autoFocus={!brand}
            className={`${FORM_INPUT_CLASS} font-[family-name:var(--font-mono)] uppercase`}
          />
        </Field>
        <Field label={`${L.field.name} *`} id="brand-name" error={errors.name?.message}>
          <Input
            id="brand-name"
            {...form.register("name")}
            autoFocus={Boolean(brand) && !readOnly}
            className={FORM_INPUT_CLASS}
          />
        </Field>
      </div>
      <Field label={L.field.logoUrl} id="brand-logo" error={errors.logoUrl?.message}>
        <div className="flex items-center gap-2">
          <UrlPreviewThumb url={logoUrl} name={name} />
          <Input
            id="brand-logo"
            {...form.register("logoUrl")}
            placeholder="https://…"
            className={FORM_INPUT_CLASS}
          />
        </div>
      </Field>
      {brand && (
        <div className="space-y-1">
          <CheckboxField control={form.control} name="active" label={L.active} />
          <p className="text-ink-tertiary text-xs">{L.activeHint}</p>
        </div>
      )}
    </FormDialogBody>
  );
}
