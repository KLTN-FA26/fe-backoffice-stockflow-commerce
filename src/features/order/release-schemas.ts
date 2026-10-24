/**
 * Release đơn — input của form (`POST /orders/{id}/release`, BE `ReleaseOrderRequest`): kho bắt buộc (`@NotNull
 * warehouseId`), hình thức giao là lựa chọn của người dùng (chỉ GỬI khi khác hình thức hiện tại — xem
 * `releaseDeliveryMode`). Dùng với react-hook-form + zodResolver.
 */

import { z } from "zod";

import {
  ORDER_DELIVERY_MODES,
  ORDER_RELEASE_REFUSAL_LABELS,
} from "@/constants/labels-delivery-mode";

export const releaseFormSchema = z.object({
  warehouseId: z.string().min(1, ORDER_RELEASE_REFUSAL_LABELS.warehouseField),
  deliveryMode: z.enum(ORDER_DELIVERY_MODES),
});

export type ReleaseFormValues = z.infer<typeof releaseFormSchema>;
