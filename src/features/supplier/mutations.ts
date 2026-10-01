/**
 * Supplier — mutations. Mọi mutation invalidate `supplierKeys.all` (list + detail) và danh sách
 * NCC dùng chung `supplierOptionKeys` (dropdown NCC ở module khác).
 * Toast lỗi tự hiển thị tiếng Việt qua `supplierErrorMessage` (không dùng message thô).
 */

import { createMutation } from "@/lib/api/query-factory";
import { supplierOptionKeys } from "@/lib/references/supplier-options";
import { toast } from "@/components/shared/Toast";

import { activateSupplier, createSupplier, deactivateSupplier, updateSupplier } from "./api";
import { supplierErrorMessage } from "./errors";
import { supplierKeys } from "./queries";

import type { SupplierDto, SupplierFormValues, SupplierUpdateInput } from "./types";

function toastError(error: unknown) {
  toast.error(supplierErrorMessage(error));
}

export const useCreateSupplier = createMutation<SupplierFormValues, SupplierDto>(createSupplier, {
  invalidate: [supplierKeys.all, supplierOptionKeys.all],
  successMessage: "Tạo nhà cung cấp thành công",
  showErrorToast: false,
  onError: toastError,
});

export const useUpdateSupplier = createMutation<SupplierUpdateInput, SupplierDto>(updateSupplier, {
  invalidate: [supplierKeys.all, supplierOptionKeys.all],
  successMessage: "Cập nhật nhà cung cấp thành công",
  showErrorToast: false,
  onError: toastError,
});

export const useActivateSupplier = createMutation<SupplierDto, SupplierDto>(activateSupplier, {
  invalidate: [supplierKeys.all, supplierOptionKeys.all],
  successMessage: "Đã kích hoạt lại nhà cung cấp",
  showErrorToast: false,
  onError: toastError,
});

export const useDeactivateSupplier = createMutation<SupplierDto, void>(deactivateSupplier, {
  invalidate: [supplierKeys.all, supplierOptionKeys.all],
  successMessage: "Đã ngừng hợp tác với nhà cung cấp",
  showErrorToast: false,
  onError: toastError,
});
