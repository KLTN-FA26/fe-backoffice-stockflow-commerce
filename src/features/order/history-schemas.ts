/**
 * Order — lịch sử đơn (`GET /orders/{id}/history`): DTO BE + mục đã phân loại cho UI.
 */

import { z } from "zod";

import { ORDER_HISTORY_ENTRY_TYPES } from "@/constants/labels-order";
import { ORDER_READ_STATUSES } from "@/constants/statuses";

import { orderDeliveryModeDtoSchema } from "./delivery-mode-schemas";
import { orderAddressDtoSchema, orderStatusDtoSchema } from "./schemas";

/**
 * BE `OrderStatusChangeResponse` (BE PR #150, "review of #150"): mỗi mục có `type` — `STATUS_CHANGE`
 * (trạng thái đi `from` → `to`) hoặc `PARTIAL_SHIPMENT_DECISION` (Sales bật / tắt giao một phần,
 * `from` / `to` null, `partialShipmentAllowed`, `reason` = ghi chú của Sales) hoặc `DELIVERY_MODE_CHANGE`
 * (BE PR #157, LP-1: điều phối viên đổi hình thức giao — `deliveryMode` mới, `previousDeliveryMode` cũ,
 * `reason` = ghi chú) hoặc `REMAINDER_CLOSURE` (Sales đóng phần còn lại, kể cả khi trạng thái đơn không đổi — BE
 * `order_remainder_closure`: `from` / `to` null, `closureReasonCode` = mã lý do, `reason` = ghi chú) hoặc `ADDRESS_CHANGE`
 * (Sale đổi địa chỉ giao trước khi dán nhãn — docs 17 BR-16: `previousAddress` → `newAddress`). Các mục sau chỉ nhân
 * viên thấy. `type` vắng (BE cũ) = STATUS_CHANGE; giá trị lạ → "UNKNOWN".
 */
export const orderHistoryEntryDtoSchema = z.object({
  type: z
    .enum([...ORDER_HISTORY_ENTRY_TYPES, "UNKNOWN"])
    .default("STATUS_CHANGE")
    .catch("UNKNOWN"),
  from: orderStatusDtoSchema.nullish(),
  to: orderStatusDtoSchema.nullish(),
  reason: z.string().nullish(),
  occurredAt: z.string(),
  actorId: z.string().nullish(),
  actorName: z.string().nullish(),
  partialShipmentAllowed: z.boolean().nullish(),
  closureReasonCode: z.string().nullish(),
  deliveryMode: orderDeliveryModeDtoSchema.nullish(),
  previousDeliveryMode: orderDeliveryModeDtoSchema.nullish(),
  previousAddress: orderAddressDtoSchema.nullish(),
  newAddress: orderAddressDtoSchema.nullish(),
});

export const orderHistoryDtoSchema = z.array(orderHistoryEntryDtoSchema);

const historyEntryBase = {
  occurredAt: z.string(),
  reason: z.string().nullable(),
  /** Tên người thực hiện; null với hệ thống / bước ghi trước G3-2. */
  actorName: z.string().nullable(),
};

/** Mục lịch sử đã phân loại — UI render theo `kind`, không đọc `type` thô. */
export const orderHistoryEntrySchema = z.discriminatedUnion("kind", [
  z.object({
    ...historyEntryBase,
    kind: z.literal("status-change"),
    /** null ở bước đầu (đơn vừa được đặt). Trạng thái BE lạ → "UNKNOWN", không làm hỏng cả lịch sử. */
    from: z.enum(ORDER_READ_STATUSES).nullable(),
    to: z.enum(ORDER_READ_STATUSES),
  }),
  z.object({
    ...historyEntryBase,
    kind: z.literal("partial-shipment"),
    /** true = Sales bật giao một phần; false = tắt. */
    allowed: z.boolean(),
  }),
  z.object({
    ...historyEntryBase,
    kind: z.literal("remainder-closure"),
    /** Mã lý do đóng (BE `CancellationReasonCode`); null khi BE không gửi. `reason` là ghi chú của Sales. */
    reasonCode: z.string().nullable(),
  }),
  z.object({
    ...historyEntryBase,
    kind: z.literal("delivery-mode"),
    mode: orderDeliveryModeDtoSchema,
    /** null khi BE không trả hình thức trước đó. */
    previousMode: orderDeliveryModeDtoSchema.nullable(),
  }),
  z.object({
    ...historyEntryBase,
    kind: z.literal("address-change"),
    /** Địa chỉ giao trước và sau khi đổi, đã ghép thành một dòng; null khi BE không gửi. */
    from: z.string().nullable(),
    to: z.string(),
  }),
  z.object({ ...historyEntryBase, kind: z.literal("unknown") }),
]);
