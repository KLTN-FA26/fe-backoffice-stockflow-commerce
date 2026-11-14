/**
 * Order — chỗ cắm cho "Thanh toán, hoá đơn & hoàn tất" (WF-05 BO-10; docs 15, 17 §4.6, 21).
 *
 * Đợt thanh toán ở `features/payment`, hoá đơn ở `features/einvoice`; feature không import chéo nhau
 * (feature-architecture.md) nên màn đơn chỉ đưa ra một khe và các dữ kiện của đơn — chỗ ghép
 * (`components/backoffice/OrderDetailWithLoadEstimate`) vẽ bảng.
 */

import type { ReactNode } from "react";

export interface OrderSettlementSlotProps {
  orderId: string;
  orderNumber: string;
  /** Trạng thái hiển thị ("Delivered", "Completed", "Return Requested", …). */
  status: string;
  deliveredAt: string | null;
  completedAt: string | null;
  closedAt: string | null;
  /** Các lần giao đã giao thành công — mỗi lần phải có hoá đơn điện tử (docs 21 BR-01). */
  deliveredShipmentIds: string[];
}

export type OrderSettlementSlot = (props: OrderSettlementSlotProps) => ReactNode;
