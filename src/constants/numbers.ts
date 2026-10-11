/**
 * Ngưỡng số dùng ≥2 chỗ. Mỗi giá trị cite nguồn (docs hoặc ràng buộc BE).
 */

/** Giới hạn đơn đặt NCC — lấy đúng ràng buộc DB/BE nhánh `test` (BE request chưa có @Size). */
export const PO_LIMITS = {
  /** BE `purchase_order_lines.note VARCHAR(255)` (BE PR #71). */
  lineDescriptionMax: 255,
  /** BE lý do khôi phục / đổi ngày giao 1..1000. */
  reasonMax: 1000,
  /** BE `purchase_orders.cancel_reason` / `close_reason VARCHAR(255)` (BE PR #71). */
  closeReasonMax: 255,
  /** BE lý do từ chối duyệt — `purchase_order_approvals.reason VARCHAR(500)`. */
  rejectReasonMax: 500,
  /** BE `purchase_orders.note TEXT`, giới hạn ở request 2000. */
  noteMax: 2000,
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
  /** BE `AdminCancelOrderRequest.note` @Size(max = 1000); bắt buộc khi reasonCode = OTHER. */
  cancelNoteMax: 1000,
  /** BE `AdminCancelOrderRequest.retainedPercent` 0..100 — phần tiền giữ lại khi huỷ. */
  retainedPercentMin: 0,
  retainedPercentMax: 100,
  /** BE `CreditDecisionRequest.note` / `CreditRefusalRequest.note` @NotBlank @Size(max = 1000). */
  creditNoteMax: 1000,
  /** BE `CreditRefusalRequest.depositPercent` — 0 < x < 100 (biên mở). */
  depositPercentMin: 0,
  depositPercentMax: 100,
  /**
   * `step` của ô nhập %: BE nhận BigDecimal (không ép số nguyên, không giới hạn scale) và zod
   * cũng chấp nhận số thập phân → "any" để validation gốc của trình duyệt không chặn 30.5%.
   */
  percentInputStep: "any",
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
