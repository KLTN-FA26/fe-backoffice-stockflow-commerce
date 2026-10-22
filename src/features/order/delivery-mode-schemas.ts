/**
 * Hình thức giao của đơn (LP-1/LP-2, BE PR #157) — DTO BE, tách khỏi `schemas.ts` (giới hạn 200 dòng / file).
 */

import { z } from "zod";

import { ORDER_DELIVERY_MODES } from "@/constants/labels-delivery-mode";

/** BE `order/api/DeliveryMode`: giao lẻ / nguyên xe. Tolerant: giá trị lạ → "UNKNOWN" (hiện "Không rõ"). */
export const orderDeliveryModeDtoSchema = z
  .enum([...ORDER_DELIVERY_MODES, "UNKNOWN"])
  .catch("UNKNOWN");
