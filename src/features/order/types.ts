/**
 * Order — types. Chỉ `z.infer` từ schemas.ts / model-schemas.ts / history-schemas.ts…, không khai báo tay
 * (api-conventions §3.1).
 *
 * Bốn kiểu trạng thái, KHÔNG chồng nghĩa:
 * - `BackendOrderStatus`: mã wire BE đã biết (19 giá trị `OrderStatus.java`) — giá trị được GỬI (lọc).
 * - `BackendOrderReadStatus`: mã BE sau khi parse response — thêm `UNKNOWN` cho chuỗi lạ.
 * - `OrderStatus` (`@/constants/statuses`): trạng thái FE đã biết — lọc, URL, lifecycle, thao tác.
 *   KHÔNG phải `OrderStatus` nội bộ 20 giá trị docs của mock-data.ts.
 * - `OrderReadStatus`: trạng thái FE trên model đã đọc — `OrderStatus` | `UNKNOWN` (chỉ hiển thị).
 */

import type { z } from "zod";

import type {
  creditHoldDtoSchema,
  creditHoldPageDtoSchema,
  creditHoldSchema,
  creditPositionDtoSchema,
  creditPositionSchema,
} from "./credit-hold-schemas";
import type { orderDeliveryModeDtoSchema } from "./delivery-mode-schemas";
import type { orderHistoryEntryDtoSchema, orderHistoryEntrySchema } from "./history-schemas";
import type {
  orderCancellationSchema,
  orderLineSchema,
  orderSchema,
  orderShipmentSchema,
} from "./model-schemas";
import type { productionOrderDtoSchema, productionOrderSchema } from "./production-schemas";
import type {
  BACKEND_ORDER_STATUSES,
  orderBalancePolicyDtoSchema,
  orderDtoSchema,
  orderPageDtoSchema,
  orderStatusDtoSchema,
} from "./schemas";

export type { OrderReadStatus, OrderStatus } from "@/constants/statuses";
export type {
  AdminCancelOrderInput,
  CreditApprovalInput,
  CreditRejectionFormInput,
  CreditRejectionInput,
} from "./action-schemas";
export type {
  AgreedFeeValues,
  DeliveryFailureValues,
  DeliveryModeValues,
  HoldOrderValues,
  PartialShipmentValues,
  RemainderClosureValues,
  ResolveOrderHoldValues,
} from "./input-schemas";

/** Mã BE gửi lên được (lọc) — chỉ giá trị đã biết, không có `UNKNOWN`. */
export type BackendOrderStatus = (typeof BACKEND_ORDER_STATUSES)[number];
/** Mã BE sau khi parse response — có thể là `UNKNOWN`. */
export type BackendOrderReadStatus = z.output<typeof orderStatusDtoSchema>;
export type OrderDto = z.output<typeof orderDtoSchema>;
export type OrderPageDto = z.output<typeof orderPageDtoSchema>;
export type Order = z.infer<typeof orderSchema>;
export type OrderLine = z.infer<typeof orderLineSchema>;
export type OrderShipment = z.infer<typeof orderShipmentSchema>;
export type OrderCancellation = z.infer<typeof orderCancellationSchema>;
export type OrderDeliveryMode = Exclude<z.infer<typeof orderDeliveryModeDtoSchema>, "UNKNOWN">;
export type OrderBalancePolicy = z.infer<typeof orderBalancePolicyDtoSchema>;
export type OrderHistoryEntryDto = z.infer<typeof orderHistoryEntryDtoSchema>;
export type OrderHistoryEntry = z.infer<typeof orderHistoryEntrySchema>;
export type CreditHoldDto = z.infer<typeof creditHoldDtoSchema>;
export type CreditHoldPageDto = z.infer<typeof creditHoldPageDtoSchema>;
export type CreditHold = z.infer<typeof creditHoldSchema>;
export type CreditPositionDto = z.output<typeof creditPositionDtoSchema>;
export type CreditPosition = z.infer<typeof creditPositionSchema>;
export type ProductionOrderDto = z.infer<typeof productionOrderDtoSchema>;
export type ProductionOrder = z.infer<typeof productionOrderSchema>;
