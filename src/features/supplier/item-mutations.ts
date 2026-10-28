/**
 * Supplier item — mutations. Mỗi mutation invalidate `supplierItemKeys.all` (danh sách tab CRUD
 * lẫn catalog của bộ chọn SKU trong form PO). Không toast lỗi ở đây: màn hình hiện lỗi một lần —
 * gắn vào ô (`supplierItemFieldErrors`) hoặc trong dialog (`supplierItemErrorMessage`); chỉ toast khi
 * `OPTIMISTIC_LOCK` (kèm tải lại).
 */

import { SHARED_QUERY_ROOTS, SUPPLIER_ITEM_TOAST_MESSAGES } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";
import { inventoryItemKeys } from "@/lib/references/inventory-item-keys";
import { supplierItemKeys } from "@/lib/references/supplier-items";

import { createSupplierItem, deleteSupplierItem, updateSupplierItem } from "./item-api";

import type {
  CreateSupplierItemInput,
  DeleteSupplierItemInput,
  UpdateSupplierItemInput,
} from "./item-api";
import type { SupplierItem } from "./types";

/**
 * Danh mục (tab CRUD + bộ chọn SKU của form PO) và hồ sơ hàng tồn: "ưu tiên" = NCC mặc định của
 * hồ sơ hàng tồn, BE `ItemPurchasingRepository.assign/clearDefaultSupplier` ghi kèm `version+1`
 * — không làm mới thì lần lưu kế ở trang Hồ sơ hàng tồn bị 409 OPTIMISTIC_LOCK. Thông tin mua hàng của
 * SKU (màn biến thể) đọc cùng `version` và `defaultSupplierId` đó nên cũng làm mới qua root dùng chung.
 */
const INVALIDATE = [
  supplierItemKeys.all,
  inventoryItemKeys.all,
  [SHARED_QUERY_ROOTS.skuPurchasing],
];

export const useCreateSupplierItem = createMutation<CreateSupplierItemInput, SupplierItem>(
  createSupplierItem,
  {
    invalidate: INVALIDATE,
    successMessage: SUPPLIER_ITEM_TOAST_MESSAGES.created,
    showErrorToast: false,
  },
);

export const useUpdateSupplierItem = createMutation<UpdateSupplierItemInput, SupplierItem>(
  updateSupplierItem,
  {
    invalidate: INVALIDATE,
    successMessage: SUPPLIER_ITEM_TOAST_MESSAGES.updated,
    showErrorToast: false,
  },
);

export const useDeleteSupplierItem = createMutation<DeleteSupplierItemInput, void>(
  deleteSupplierItem,
  {
    invalidate: INVALIDATE,
    successMessage: SUPPLIER_ITEM_TOAST_MESSAGES.deleted,
    showErrorToast: false,
  },
);
