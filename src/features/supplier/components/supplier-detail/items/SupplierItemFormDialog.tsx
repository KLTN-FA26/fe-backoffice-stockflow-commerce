"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { SUPPLIER_ITEM_ERROR_MESSAGES, SUPPLIER_ITEM_UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import {
  supplierItemErrorMessage,
  supplierItemFieldErrors,
  supplierItemFormSchema,
  useCreateSupplierItem,
  useUpdateSupplierItem,
} from "@/features/supplier";
import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { toast } from "@/components/shared/Toast";

import { EMPTY_ITEM_VALUES, toItemFormValues } from "./supplier-item-form-values";
import { SupplierItemFields } from "./SupplierItemFields";

import type { SupplierItem, SupplierItemFormValues } from "@/features/supplier/types";
import type { ItemTextField } from "./supplier-item-form-values";

const L = SUPPLIER_ITEM_UI_LABELS;

interface ItemFormProps {
  supplierId: string;
  item: SupplierItem | null; // có = sửa (SKU khoá, gửi `version`); null = thêm
  currency: string | null; // tiền tệ NCC suy từ danh mục (null khi rỗng → để BE quyết)
  onConflict: () => void; // 409 OPTIMISTIC_LOCK: dòng đã đổi — tải lại danh sách
}

/** Thêm / sửa một dòng danh mục hàng NCC (BE `POST|PUT /suppliers/{id}/items`). */
export function SupplierItemFormDialog({
  open,
  onOpenChange,
  ...props
}: ItemFormProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange}>
      {open && <ItemForm {...props} onDone={() => onOpenChange(false)} />}
    </FormDialog>
  );
}

function ItemForm({
  supplierId,
  item,
  currency,
  onConflict,
  onDone,
}: ItemFormProps & { onDone: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<SupplierItemFormValues>({
    resolver: zodResolver(supplierItemFormSchema(item?.currency ?? currency)),
    // Validate realtime (Mode A): lỗi hiện ngay ô, nút Lưu khoá tới khi hợp lệ
    mode: "onChange",
    defaultValues: item ? toItemFormValues(item) : EMPTY_ITEM_VALUES,
  });
  const create = useCreateSupplierItem();
  const update = useUpdateSupplierItem();
  const { isValid } = form.formState;

  const onError = (error: unknown) => {
    // Lỗi chỉ hiện một lần: gắn vào ô hoặc trong dialog; toast riêng cho version cũ (dialog đóng)
    if (error instanceof ApiError && error.code === "OPTIMISTIC_LOCK") {
      toast.error(SUPPLIER_ITEM_ERROR_MESSAGES.OPTIMISTIC_LOCK);
      onConflict();
      onDone();
      return;
    }
    const fields = error instanceof ApiError ? supplierItemFieldErrors(error) : {};
    const entries = Object.entries(fields) as [ItemTextField, string][];
    for (const [name, message] of entries) form.setError(name, { type: "server", message });
    setServerError(entries.length > 0 ? null : supplierItemErrorMessage(error));
  };
  const save = (values: SupplierItemFormValues) => {
    setServerError(null);
    const handlers = { onSuccess: onDone, onError };
    if (item) update.mutate({ supplierId, item, values }, handlers);
    else create.mutate({ supplierId, values }, handlers);
  };

  return (
    <FormDialogBody
      title={item ? L.editTitle : L.addTitle}
      description={item ? L.editDescription(item.sku) : L.addDescription}
      submitLabel={L.action.save}
      canSubmit={isValid}
      isPending={create.isPending || update.isPending}
      error={serverError}
      onSubmit={() => void form.handleSubmit(save)()}
      onCancel={onDone}
    >
      <SupplierItemFields form={form} item={item} supplierId={supplierId} />
    </FormDialogBody>
  );
}
