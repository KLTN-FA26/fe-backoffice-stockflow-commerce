/**
 * Release đơn — input của form (`POST /orders/{id}/release`, BE `ReleaseOrderRequest`): kho bắt buộc (`@NotNull
 * warehouseId`); đợt giao (`deliveryBatchId`) tuỳ chọn — bỏ trống = đợt kế tiếp (docs 17 BR-29). Không còn hình thức
 * giao. Dùng với react-hook-form + zodResolver.
 */

import { z } from "zod";

import { ORDER_RELEASE_REFUSAL_LABELS } from "@/constants/labels-order-release";

export const releaseFormSchema = z.object({
  warehouseId: z.string().min(1, ORDER_RELEASE_REFUSAL_LABELS.warehouseField),
  deliveryBatchId: z.string().optional(),
});

export type ReleaseFormValues = z.infer<typeof releaseFormSchema>;
