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

/**
 * `GET /orders/{id}/release-warnings` (BE `OrderReleaseController`, WF4-OVERDUE-WARN): what to know before releasing,
 * never a reason to refuse it. `creditWarning.outcome` is `OVERDUE` when the customer has a payment instalment past its
 * due day; the field is absent (or null) when there is nothing to warn about — the same shape as the contract's
 * `creditWarning` (docs 15 BR-11).
 */
export const releaseWarningsSchema = z.object({
  creditWarning: z.object({ outcome: z.string() }).nullish(),
});

export type ReleaseWarnings = z.infer<typeof releaseWarningsSchema>;
