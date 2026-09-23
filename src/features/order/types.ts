/**
 * Order — types.
 *
 * `Order`/`OrderLine` re-export nguyên trạng từ mock-data.ts (chưa có backend
 * DTO thật để generate schema — theo pattern feature-architecture §7 khi chưa
 * đủ field để viết zod DTO đầy đủ).
 *
 * `OrderStatus` lấy từ `@/constants/statuses` (superset 21 giá trị, gồm
 * "Draft" mới) — KHÔNG phải `OrderStatus` nội bộ 20 giá trị của mock-data.ts.
 */

export type { Order, OrderEvent, OrderLine } from "@/lib/mock-data";
export type { OrderStatus } from "@/constants/statuses";
