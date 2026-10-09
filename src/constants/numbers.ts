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

export const ORDER_LIMITS = {
  /**
   * Độ dài tối đa lý do huỷ đơn — cột `ordering.orders.cancellation_reason VARCHAR(500)`
   * (BE migration V20260901000300__ordering_orders.sql). `AdminCancelOrderRequest` chỉ có
   * @NotBlank nên FE phải chặn, quá dài → DB từ chối → BE trả 500.
   */
  cancelReasonMax: 500,
} as const;

/** Giới hạn phiếu nhận — đúng ràng buộc request BE goods receipt (PR #62, SCRUM-435). */
export const RECEIPT_LIMITS = {
  /** `ReceiptLinesRequest.lines` @Size(max = 200). */
  linesMax: 200,
  /** `ReceiptLinesRequest.Line.lotNumber` / `locationCode` @Size(max = 64); `MoveToQcRequest`. */
  codeMax: 64,
  /** `ReceiptLinesRequest.Line.note` @Size(max = 255). */
  lineNoteMax: 255,
  /** `CreateGoodsReceiptRequest.deliveryNote` @Size(max = 100). */
  deliveryNoteMax: 100,
  /** `CreateGoodsReceiptRequest.note` @Size(max = 2000). */
  noteMax: 2000,
  /** `QcDecisionRequest.Part.reason` @Size(max = 500). */
  qcReasonMax: 500,
} as const;
