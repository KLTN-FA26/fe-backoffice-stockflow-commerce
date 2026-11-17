/**
 * Order — chỗ cắm cho "Trả hàng" (WF-05 BO-13; docs 17 §4.10). Yêu cầu trả hàng ở `features/return`; feature không
 * import chéo nhau (feature-architecture.md) nên màn đơn chỉ đưa ra một khe và các dữ kiện của đơn — chỗ ghép
 * (`components/backoffice/OrderDetailWithLoadEstimate`) vẽ thẻ.
 */

import type { ReactNode } from "react";

export interface OrderReturnsSlotLine {
  lineId: string;
  sku: string;
  /** Số đã giao (BE `quantity − cancelledQuantity` khi chưa có `deliveredQuantity`). */
  deliveredQuantity: number;
  /** In theo thiết kế của khách — chỉ trả vì lỗi có tên (BR-RMA-002). */
  customPrinted: boolean;
}

export interface OrderReturnsSlotProps {
  orderId: string;
  orderNumber: string;
  /** Trạng thái hiển thị ("Delivered", "Return Requested", …). */
  status: string;
  deliveredAt: string | null;
  lines: OrderReturnsSlotLine[];
}

export type OrderReturnsSlot = (props: OrderReturnsSlotProps) => ReactNode;
