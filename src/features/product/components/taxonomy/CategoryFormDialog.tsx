"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { PRODUCT_PERMISSIONS, UI_LABELS } from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { toast } from "@/components/shared/Toast";

import { makeCategoryFormSchema } from "../../taxonomy-input-schemas";
import { isStaleTaxonomyError, taxonomyFormError } from "../../taxonomy-errors";
import { useCreateCategory, useUpdateCategory } from "../../taxonomy-mutations";
import { CategoryFormFields } from "./CategoryFormFields";

import type { CategoryFormValues } from "../../taxonomy-input-schemas";
import type { CategoryNode } from "../../taxonomy-schemas";

const L = UI_LABELS.taxonomy;
const CATEGORY_FIELDS = [
  "code",
  "parentId",
  "name",
  "sortOrder",
  "imageUrl",
  "seoTitle",
  "seoDescription",
] as const satisfies readonly (keyof CategoryFormValues)[];
type CategoryTextField = (typeof CATEGORY_FIELDS)[number];
const isCategoryField = (field: string | undefined): field is CategoryTextField =>
  field !== undefined && (CATEGORY_FIELDS as readonly string[]).includes(field);

/** Tạo (`category` trống) / sửa / xem danh mục — mã và cha bất biến, không xoá (ngưng dùng). */
export function CategoryFormDialog({
  category,
  open,
  onOpenChange,
}: {
  category?: CategoryNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange}>
      {open && <CategoryForm category={category} onDone={() => onOpenChange(false)} />}
    </FormDialog>
  );
}

function CategoryForm({ category, onDone }: { category?: CategoryNode; onDone: () => void }) {
  const can = usePermissionChecker();
  const mode = category ? "edit" : "create";
  // UI-only — Backend phải re-check (@RequiresPermission product-products:UPDATE)
  const readOnly = Boolean(category) && !can(PRODUCT_PERMISSIONS.update);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(makeCategoryFormSchema(mode)),
    mode: "onChange",
    defaultValues: {
      code: category?.code ?? "",
      parentId: category?.parentId ?? "",
      name: category?.name ?? "",
      sortOrder: category ? String(category.sortOrder) : "",
      imageUrl: category?.imageUrl ?? "",
      seoTitle: category?.seoTitle ?? "",
      seoDescription: category?.seoDescription ?? "",
      active: category?.active ?? true,
    },
  });
  const create = useCreateCategory();
  const update = useUpdateCategory();

  const submit = form.handleSubmit((values) => {
    setError(null);
    const onError = (e: unknown) => {
      const { field, message } = taxonomyFormError(e, mode);
      // Bản ghi đã bị sửa / không còn: danh sách vừa tải lại → đóng dialog và báo bằng toast. Không
      // để người dùng bấm Lưu lại trên dữ liệu cũ — PUT của BE không có version nên sẽ ghi đè.
      if (category && isStaleTaxonomyError(e)) {
        toast.error(L.staleTitle, message);
        onDone();
        return;
      }
      // Tạo mà danh mục cha không còn: bỏ lựa chọn cũ (ô chọn vừa tải lại, không còn option đó).
      // Lỗi "cây quá 11 cấp" cũng gắn vào ô cha nhưng giữ lựa chọn để người dùng thấy cha nào sâu.
      if (isStaleTaxonomyError(e)) form.setValue("parentId", "");
      if (isCategoryField(field)) form.setError(field, { message });
      else setError(message);
    };
    if (category) {
      update.mutate({ categoryId: category.categoryId, values }, { onSuccess: onDone, onError });
    } else {
      create.mutate(values, { onSuccess: onDone, onError });
    }
  });

  return (
    <FormDialogBody
      title={
        !category
          ? L.createCategory
          : `${readOnly ? L.categoryTitle : "Sửa danh mục"} ${category.code}`
      }
      description={!category ? L.codeHint : readOnly ? L.readOnlyHint : L.categoryLockedHint}
      submitLabel={category ? "Lưu" : L.createCategory}
      canSubmit={form.formState.isValid}
      isPending={create.isPending || update.isPending}
      error={error}
      readOnly={readOnly}
      onSubmit={() => void submit()}
      onCancel={onDone}
    >
      <CategoryFormFields form={form} category={category} readOnly={readOnly} />
    </FormDialogBody>
  );
}
