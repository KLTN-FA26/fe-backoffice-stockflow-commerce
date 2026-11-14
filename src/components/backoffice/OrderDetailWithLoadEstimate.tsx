"use client";

import { LoadEstimateButton } from "@/features/load-planning";
import { OrderDetail } from "@/features/order";

import { OrderSettlementPanel } from "./OrderSettlementPanel";

import type { OrderEstimateSlot, OrderSettlementSlot } from "@/features/order";

/**
 * Chỗ ghép màn chi tiết đơn với "Ước tính xếp xe" (SCRUM-287 F3). Hai feature không import chéo nhau
 * (feature-architecture.md), nên đây — một component client ở lớp ghép, được `page.tsx` dùng — là nơi duy nhất biết cả
 * hai: đưa nút ước tính của `load-planning` vào khe `estimateSlot` của `order`. Khe là hàm nên không truyền thẳng từ
 * Server Component của `page.tsx` được.
 */
const renderEstimate: OrderEstimateSlot = (props) => <LoadEstimateButton {...props} />;
/** WF-05 BO-10: thanh toán (`payment`), hoá đơn (`einvoice`) và điều kiện hoàn tất trên màn đơn. */
const renderSettlement: OrderSettlementSlot = (props) => <OrderSettlementPanel {...props} />;

export function OrderDetailWithLoadEstimate({ params }: { params: Promise<{ id: string }> }) {
  return (
    <OrderDetail params={params} estimateSlot={renderEstimate} settlementSlot={renderSettlement} />
  );
}
