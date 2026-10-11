/**
 * Order — types. Chỉ `z.infer` từ schemas, không khai báo tay (api-conventions §3.1).
 *
 * `OrderStatus` lấy từ `@/constants/statuses` (đúng 12 trạng thái BE, ánh xạ 1-1 với mã wire) —
 * KHÔNG phải `OrderStatus` nội bộ 20 giá trị docs của mock-data.ts.
 */

import type { z } from "zod";

import type {
  creditHoldDtoSchema,
  creditHoldPageDtoSchema,
  creditHoldSchema,
} from "./credit-hold-schemas";
import type { productionOrderDtoSchema, productionOrderSchema } from "./production-schemas";
import type {
  orderDtoSchema,
  orderLineSchema,
  orderPageDtoSchema,
  orderSchema,
  orderStatusChangeDtoSchema,
  orderStatusChangeSchema,
  orderStatusDtoSchema,
} from "./schemas";

export type { OrderStatus } from "@/constants/statuses";
export type {
  AdminCancelOrderInput,
  CreditApprovalInput,
  CreditRejectionFormInput,
  CreditRejectionInput,
  ReleaseOrderInput,
} from "./action-schemas";

export type BackendOrderStatus = z.infer<typeof orderStatusDtoSchema>;
export type OrderDto = z.infer<typeof orderDtoSchema>;
export type OrderPageDto = z.infer<typeof orderPageDtoSchema>;
export type Order = z.infer<typeof orderSchema>;
export type OrderLine = z.infer<typeof orderLineSchema>;
export type OrderStatusChangeDto = z.infer<typeof orderStatusChangeDtoSchema>;
export type OrderStatusChange = z.infer<typeof orderStatusChangeSchema>;
export type CreditHoldDto = z.infer<typeof creditHoldDtoSchema>;
export type CreditHoldPageDto = z.infer<typeof creditHoldPageDtoSchema>;
export type CreditHold = z.infer<typeof creditHoldSchema>;
export type ProductionOrderDto = z.infer<typeof productionOrderDtoSchema>;
export type ProductionOrder = z.infer<typeof productionOrderSchema>;
