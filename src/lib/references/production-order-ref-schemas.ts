import { z } from "zod";

import { PRODUCTION_ORDER_STATUSES } from "@/constants";

/** Dòng Đơn sản xuất (BE `ProductionOrderResponse.Line`) — chỉ phần phiếu nhập cần: số thùng đặt / đã nhận. */
const productionLineRefSchema = z.object({
  id: z.string(),
  sku: z.string(),
  cartons: z.number().int(),
  unitsPerCarton: z.number().int(),
  receivedCartons: z.number().int(),
});

export const productionOrderRefSchema = z.object({
  id: z.string(),
  code: z.string(),
  status: z.enum(PRODUCTION_ORDER_STATUSES),
  receivingWarehouseId: z.string(),
  sampleApprovalRequired: z.boolean(),
  needByDate: z.string().nullish(),
  /** Ngày đơn vị sản xuất báo xong (ngày giao dự kiến) — ghi khi nhận đơn. */
  expectedCompletionDate: z.string().nullish(),
  /** Tên đơn vị sản xuất do BE kèm sẵn (FE#286) — dòng danh sách nêu tên, không cần quyền đọc danh mục đơn vị. */
  producerName: z.string().nullish(),
  lines: z.array(productionLineRefSchema).default([]),
});
export const productionOrderRefPageSchema = z.object({ items: z.array(productionOrderRefSchema) });

export type ProductionOrderRef = z.infer<typeof productionOrderRefSchema>;
export type ProductionLineRef = z.infer<typeof productionLineRefSchema>;
