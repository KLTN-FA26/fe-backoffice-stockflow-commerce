/**
 * Order — types. Chỉ `z.infer` từ schemas.ts / model-schemas.ts / history-schemas.ts, không khai báo tay (api-conventions §3.1).
 *
 * `OrderStatus` lấy từ `@/constants/statuses` (đúng 10 trạng thái BE, ánh xạ 1-1 với mã wire) —
 * KHÔNG phải `OrderStatus` nội bộ 20 giá trị docs của mock-data.ts.
 */

import type { z } from "zod";

import type { orderDeliveryModeDtoSchema } from "./delivery-mode-schemas";
import type { orderHistoryEntryDtoSchema, orderHistoryEntrySchema } from "./history-schemas";
import type { orderLineSchema, orderSchema } from "./model-schemas";
import type {
  orderBalancePolicyDtoSchema,
  orderDtoSchema,
  orderPageDtoSchema,
  orderStatusDtoSchema,
} from "./schemas";

export type { OrderStatus } from "@/constants/statuses";

export type BackendOrderStatus = z.infer<typeof orderStatusDtoSchema>;
export type OrderDto = z.infer<typeof orderDtoSchema>;
export type OrderPageDto = z.infer<typeof orderPageDtoSchema>;
export type Order = z.infer<typeof orderSchema>;
export type OrderLine = z.infer<typeof orderLineSchema>;
export type OrderDeliveryMode = Exclude<z.infer<typeof orderDeliveryModeDtoSchema>, "UNKNOWN">;
export type OrderBalancePolicy = z.infer<typeof orderBalancePolicyDtoSchema>;
export type OrderHistoryEntryDto = z.infer<typeof orderHistoryEntryDtoSchema>;
export type OrderHistoryEntry = z.infer<typeof orderHistoryEntrySchema>;
