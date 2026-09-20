/**
 * Supplier — mutations.
 *
 * All mutations invalidate supplierKeys.all (list + detail) so both
 * pages stay in sync after any write operation.
 */

import { createMutation } from "@/lib/api/query-factory";

import { supplierKeys } from "./queries";
import { createSupplier, updateSupplier, toggleSupplierStatus } from "./api";

import type {
  SupplierCreateInput,
  SupplierUpdateInput,
  SupplierToggleStatusInput,
  SupplierDto,
} from "./types";

export const useCreateSupplier = createMutation<SupplierCreateInput, SupplierDto>(createSupplier, {
  invalidate: [supplierKeys.all],
  successMessage: "Tạo nhà cung cấp thành công",
});

export const useUpdateSupplier = createMutation<SupplierUpdateInput, SupplierDto>(updateSupplier, {
  invalidate: [supplierKeys.all],
  successMessage: "Cập nhật nhà cung cấp thành công",
});

export const useToggleSupplierStatus = createMutation<SupplierToggleStatusInput, SupplierDto>(
  toggleSupplierStatus,
  {
    invalidate: [supplierKeys.all],
    successMessage: "Cập nhật trạng thái thành công",
  },
);
