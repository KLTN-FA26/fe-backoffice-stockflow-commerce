/**
 * Purchase Order — types. Chỉ `z.infer` từ schemas, không khai báo type tay.
 */

import type {
  DeliveryAttempt,
  DeliveryDecision,
  PoDeliveryStatus,
  PoLineDto,
  PoStatusValue,
  PurchaseOrderDto,
  SupplierConfirmationStatus,
} from "./schemas";

export type PoStatus = PoStatusValue;
export type PoLine = PoLineDto;
export type PurchaseOrder = PurchaseOrderDto;

export type { DeliveryAttempt, DeliveryDecision, PoDeliveryStatus, SupplierConfirmationStatus };
