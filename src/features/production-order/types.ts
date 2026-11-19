import type { z } from "zod";
import type { expectedDateInput, productionOrderEditInput } from "./input-schemas";
import type {
  dispatchDto,
  dispatchMessageDto,
  productionOrderCapacityDto,
  productionOrderDto,
  productionOrderHistoryDto,
  productionOrderLineDto,
  salesOrderBatchesDto,
} from "./schemas";

export type ProductionOrder = z.infer<typeof productionOrderDto>;
export type ProductionOrderLine = z.infer<typeof productionOrderLineDto>;
export type ProductionOrderHistoryEntry = z.infer<typeof productionOrderHistoryDto>;
export type ProductionOrderCapacity = z.infer<typeof productionOrderCapacityDto>;
export type ProductionOrderStatusValue = ProductionOrder["status"];
export type ProductionOrderDispatch = z.infer<typeof dispatchDto>;
export type DispatchMessage = z.infer<typeof dispatchMessageDto>;
export type SalesOrderBatches = z.infer<typeof salesOrderBatchesDto>;
export type ProductionOrderEditValues = z.infer<typeof productionOrderEditInput>;
export type ExpectedDateValues = z.infer<ReturnType<typeof expectedDateInput>>;

/** Lập từ đợt giao còn thiếu (BR-05): BE tự điền dòng, kho nhận, ngày cần hàng, cờ duyệt mẫu. */
export interface DrawUpInput {
  salesOrderId: string;
  deliveryBatchSeq: number;
  producerId: string;
}

/** Thao tác chỉ cần `version` (gửi duyệt, duyệt). */
export interface VersionInput {
  id: string;
  version: number;
}

/** Trả lại / huỷ / đóng — lý do bắt buộc, ≤ 500 ký tự. */
export interface ReasonInput extends VersionInput {
  reason: string;
}

/** Ghi nhận nhận đơn / đổi ngày dự kiến / bắt đầu sản xuất (ngày tuỳ chọn). */
export interface ExpectedDateInput extends VersionInput {
  expectedCompletionDate: string | null;
}

/** Body `PUT /production-orders/{id}` (BE `EditProductionOrderRequest`) — `lines` chỉ dòng muốn đổi. */
export interface EditInput extends VersionInput {
  body: {
    producerId: string;
    needByDate: string;
    note?: string;
    sampleApprovalRequired: boolean;
    sampleWaiverReason?: string;
    lines: { orderLineId: string; cartons: number; packingRequirements?: string }[];
  };
}
