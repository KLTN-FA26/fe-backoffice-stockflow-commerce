/**
 * Sản phẩm nhận thay đổi gì ở trạng thái hiện tại — gate dùng chung cho biến thể và ảnh, để
 * component không tự so chuỗi trạng thái. UI-only: Backend phải re-check và trả 409 / 403.
 */
import { PRODUCT_PERMISSIONS, PRODUCT_STATUS } from "@/constants";

import type { PermissionCode } from "@/lib/auth/me-permissions";
import type { ProductStatus } from "./types";

export interface ProductChangeGate {
  /**
   * BE `Product.acceptsChanges` (`ProductVariantService.requireChangeable`): không Chờ duyệt, không
   * Ngừng kinh doanh — biến thể, ảnh mới sửa được. Trạng thái FE không biết (`UNKNOWN`) → coi như không.
   */
  readonly acceptsChanges: boolean;
  /** Đã duyệt / đang bán (APPROVED | PUBLISHED): kích hoạt biến thể, xuất bản ảnh. */
  readonly approved: boolean;
}

export function productChangeGate(status: ProductStatus): ProductChangeGate {
  const approved = status === PRODUCT_STATUS.APPROVED || status === PRODUCT_STATUS.PUBLISHED;
  const acceptsChanges =
    approved || status === PRODUCT_STATUS.DRAFT || status === PRODUCT_STATUS.INACTIVE;
  return { acceptsChanges, approved };
}

export interface MediaCapabilities {
  /** Tải ảnh mới lên (biến thể chưa ngừng dùng). */
  readonly upload: boolean;
  /** Đặt ảnh bìa, xoá ảnh — cả khi biến thể đã ngừng dùng. */
  readonly manage: boolean;
  /** Xuất bản ảnh lên cửa hàng. */
  readonly publish: boolean;
  /** Gỡ ảnh khỏi cửa hàng. */
  readonly withdraw: boolean;
}

/**
 * Thao tác ảnh của một biến thể (BE `ProductMediaService`, `ProductMediaController`):
 * - tải lên: `product-products:UPDATE` + `requireAcceptsImages` (SP nhận thay đổi, biến thể chưa
 *   ngừng dùng);
 * - xoá / đặt ảnh bìa (`delete` / `describe`): `product-products:UPDATE` + chỉ `requireChangeable` —
 *   biến thể ngừng dùng vẫn dọn ảnh cũ được;
 * - xuất bản: `product-products:APPROVE` + `publish` chỉ khi SP APPROVED | PUBLISHED, khác thì 409
 *   PRODUCT_NOT_APPROVED;
 * - gỡ: `product-products:APPROVE` + `withdraw` chỉ `requireChangeable` — Nháp / Tạm ngưng vẫn gỡ được.
 */
export function mediaCapabilities(
  gate: ProductChangeGate,
  can: (permission: PermissionCode) => boolean,
  variantObsolete = false,
): MediaCapabilities {
  const canApprove = can(PRODUCT_PERMISSIONS.approve);
  const manage = gate.acceptsChanges && can(PRODUCT_PERMISSIONS.update);
  return {
    upload: manage && !variantObsolete,
    manage,
    publish: gate.approved && canApprove,
    withdraw: gate.acceptsChanges && canApprove,
  };
}
