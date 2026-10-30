"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";

import { fieldOfError, warehouseMapErrorMessage } from "@/features/warehouse-map/errors";
import {
  EMPTY_WAREHOUSE_FORM,
  warehouseCreateSchema,
} from "@/features/warehouse-map/input-schemas";
import { useCreateWarehouse } from "@/features/warehouse-map/mutations";

import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";

import { WarehouseCreateFields } from "./WarehouseCreateFields";

import type { WarehouseCreateBody, WarehouseCreateInput } from "@/features/warehouse-map/types";

const L = UI_LABELS.warehouseMap;

/**
 * Modal khai báo kho mới (docs 06 §4.1 bước 1, BE `POST /warehouses`): prefix, tên, địa chỉ, khung bản
 * đồ + xem trước khung. Mở từ nút "Tạo kho" của danh mục kho — chỉ hiện khi có
 * `warehouse-warehouses:CREATE` (UI-only, Backend phải re-check). Prefix trùng → lỗi ngay ô prefix;
 * tạo xong mở bản đồ của kho mới để bắt đầu vẽ.
 */
export function WarehouseCreateDialog({ onClose }: { onClose: () => void }) {
  return (
    // Hai cột (thông tin + địa chỉ | khung bản đồ + xem trước) → rộng hơn modal form mặc định
    <FormDialog open onOpenChange={(next) => !next && onClose()} className="sm:max-w-[880px]">
      <WarehouseCreateForm onClose={onClose} />
    </FormDialog>
  );
}

function WarehouseCreateForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const create = useCreateWarehouse();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<WarehouseCreateInput, unknown, WarehouseCreateBody>({
    resolver: zodResolver(warehouseCreateSchema),
    mode: "onChange",
    defaultValues: EMPTY_WAREHOUSE_FORM,
  });

  const submit = form.handleSubmit((body) => {
    setServerError(null);
    create.mutate(body, {
      // Kho mới có bản đồ rỗng → mở ngay bản đồ để vẽ (docs 06 §4.1 bước 2–7)
      onSuccess: (warehouse) => {
        onClose();
        router.push(ADMIN_ROUTES.warehouseMap.of(warehouse.prefix));
      },
      onError: (error) => {
        const message = warehouseMapErrorMessage(error);
        if (fieldOfError(error) === "prefix") form.setError("prefix", { type: "server", message });
        else setServerError(message);
      },
    });
  });

  return (
    <FormDialogBody
      title={L.createTitle}
      description={L.form.description}
      submitLabel={L.form.submit}
      canSubmit={form.formState.isValid}
      isPending={create.isPending}
      error={serverError}
      onSubmit={() => void submit()}
      onCancel={onClose}
    >
      <div className="max-h-[calc(100vh-15rem)] overflow-y-auto pr-1">
        <WarehouseCreateFields form={form} />
      </div>
    </FormDialogBody>
  );
}
