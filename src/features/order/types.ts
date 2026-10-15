/**
 * Order — types. Chỉ `z.infer` từ schemas, không khai báo tay (api-conventions §3.1).
 *
 * `OrderStatus` lấy từ `@/constants/statuses` (12 trạng thái BE FE hỗ trợ, ánh xạ 1-1 với mã wire;
 * dùng cho lọc / gửi BE) — KHÔNG phải `OrderStatus` nội bộ 20 giá trị docs của mock-data.ts.
 * `OrderReadStatus` = `OrderStatus` | `UNKNOWN`: trạng thái trên model đã đọc từ BE.
 */

import type { z } from "zod";

import type {
  creditHoldDtoSchema,
  creditHoldPageDtoSchema,
  creditHoldSchema,
  creditPositionDtoSchema,
  creditPositionSchema,
} from "./credit-hold-schemas";
import type { productionOrderDtoSchema, productionOrderSchema } from "./production-schemas";
import type {
  BACKEND_ORDER_STATUSES,
  orderDtoSchema,
  orderLineSchema,
  orderPageDtoSchema,
  orderSchema,
  orderStatusChangeDtoSchema,
  orderStatusChangeSchema,
  orderStatusDtoSchema,
} from "./schemas";

export type { OrderReadStatus, OrderStatus } from "@/constants/statuses";
export type {
  AdminCancelOrderInput,
  CreditApprovalInput,
  CreditRejectionFormInput,
  CreditRejectionInput,
  ReleaseOrderInput,
} from "./action-schemas";

/** Mã BE gửi lên được (lọc) — chỉ giá trị đã biết, không có `UNKNOWN`. */
export type BackendOrderStatus = (typeof BACKEND_ORDER_STATUSES)[number];
/** Mã BE sau khi parse response — có thể là `UNKNOWN`. */
export type BackendOrderReadStatus = z.infer<typeof orderStatusDtoSchema>;
export type OrderDto = z.infer<typeof orderDtoSchema>;
export type OrderPageDto = z.infer<typeof orderPageDtoSchema>;
export type Order = z.infer<typeof orderSchema>;
export type OrderLine = z.infer<typeof orderLineSchema>;
export type OrderStatusChangeDto = z.infer<typeof orderStatusChangeDtoSchema>;
export type OrderStatusChange = z.infer<typeof orderStatusChangeSchema>;
export type CreditHoldDto = z.infer<typeof creditHoldDtoSchema>;
export type CreditHoldPageDto = z.infer<typeof creditHoldPageDtoSchema>;
export type CreditHold = z.infer<typeof creditHoldSchema>;
export type CreditPositionDto = z.output<typeof creditPositionDtoSchema>;
export type CreditPosition = z.infer<typeof creditPositionSchema>;
export type ProductionOrderDto = z.infer<typeof productionOrderDtoSchema>;
export type ProductionOrder = z.infer<typeof productionOrderSchema>;
