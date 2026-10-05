/**
 * Ngưỡng / giới hạn số — mỗi giá trị cite nguồn (CLAUDE.md "Không hardcode string/số").
 */

export const ORDER_LIMITS = {
  /**
   * Độ dài tối đa lý do huỷ đơn — cột `ordering.orders.cancellation_reason VARCHAR(500)`
   * (BE migration V20260901000300__ordering_orders.sql). `AdminCancelOrderRequest` chỉ có
   * @NotBlank nên FE phải chặn, quá dài → DB từ chối → BE trả 500.
   */
  cancelReasonMax: 500,
} as const;
