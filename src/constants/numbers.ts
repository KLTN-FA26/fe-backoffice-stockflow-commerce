/**
 * Ngưỡng số dùng ≥2 chỗ. Mỗi giá trị cite nguồn (docs hoặc ràng buộc BE).
 */

/** Giới hạn đơn đặt NCC — lấy đúng ràng buộc DB/BE nhánh `test` (BE request chưa có @Size). */
export const PO_LIMITS = {
  /** BE `procurement.po_line.description VARCHAR(300)`. */
  lineDescriptionMax: 300,
  /** BE lý do huỷ / đóng thiếu `VARCHAR(1000)`; lý do khôi phục / đổi ngày giao 1..1000. */
  reasonMax: 1000,
  /** BE `SupplierConfirmationRequest.supplierReference` @Size(max = 100). */
  supplierReferenceMax: 100,
  /** BE `int quantityOrdered` (Java int). */
  quantityMax: 2_147_483_647,
  /**
   * Chu kỳ tải lại PO + lần gửi khi đang gửi NCC (QUEUED / RETRYING). BE gửi bất đồng bộ
   * (`@ApplicationModuleListener`) — thường xong sau ~1 giây; dừng khi DELIVERED / FAILED.
   */
  deliveryPollMs: 3000,
} as const;
