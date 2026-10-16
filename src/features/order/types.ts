/**
 * Order — types. Chỉ `z.infer` từ schemas.ts, không khai báo tay (api-conventions §3.1).
 *
 * `OrderStatus` lấy từ `@/constants/statuses` (đúng 10 trạng thái BE, ánh xạ 1-1 với mã wire) —
 * KHÔNG phải `OrderStatus` nội bộ 20 giá trị docs của mock-data.ts.
 */

import type { z } from "zod";

import type {
  orderDtoSchema,
  orderLineSchema,
  orderPageDtoSchema,
  orderSchema,
  orderStatusDtoSchema,
} from "./schemas";

export type { OrderStatus } from "@/constants/statuses";

export type BackendOrderStatus = z.infer<typeof orderStatusDtoSchema>;
export type OrderDto = z.infer<typeof orderDtoSchema>;
export type OrderPageDto = z.infer<typeof orderPageDtoSchema>;
export type Order = z.infer<typeof orderSchema>;
export type OrderLine = z.infer<typeof orderLineSchema>;
