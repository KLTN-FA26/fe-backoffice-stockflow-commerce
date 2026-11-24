/**
 * Order — chỗ cắm cho "Thanh toán, hoá đơn & hoàn tất" (WF-05 BO-10; docs 15, 17 §4.6, 21).
 *
 * Đợt thanh toán ở `features/payment`, hoá đơn ở `features/einvoice`; feature không import chéo nhau
 * (feature-architecture.md) nên màn đơn chỉ đưa ra một khe và các dữ kiện của đơn — chỗ ghép
 * (`components/backoffice/OrderDetailWithLoadEstimate`) vẽ bảng.
 */

import type { ReactNode } from "react";
import type { SettlementReadiness } from "./types";

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
  /** WF-05 GH-2: Sale đang giữ hoàn tất đơn; null = chưa đọc được (đang tải / lỗi). */
  completionHeld: boolean | null;
  /**
   * WF-05 BO-02 (F-1): khối điều kiện hoàn tất / đóng do BE tính. Có thì bảng CHỈ hiển thị khối này (không tự tính lại);
   * null = BE không trả (chưa giao gì, hoặc BE cũ) → bảng dùng ước tính dự phòng cho đơn đã giao.
   */
  settlementReadiness: SettlementReadiness | null;
  /** Hạn đổi trả của hợp đồng (ngày) cho ước tính dự phòng; null = chưa đọc được / hợp đồng không ghi → mặc định. */
  returnWindowDays: number | null;
}

export type OrderSettlementSlot = (props: OrderSettlementSlotProps) => ReactNode;
