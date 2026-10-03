/**
 * Purchase Order — BE wire DTO → FE view model. Thuần, không I/O.
 *
 * Đầu vào đã qua zod (`bePurchaseOrderSchema`) nên status chắc chắn là 1 trong 7 mã BE.
 * Tiền tệ giữ NGUYÊN mã BE trả (vd EUR) — không âm thầm đổi thành VND.
 */

import { toLocalIsoDate } from "@/lib/format";

import type { BePoLineDto, BePurchaseOrderDto } from "./schemas";
import type { PoLine, PurchaseOrder } from "./types";

function mapLine(be: BePoLineDto, poId: string, currency: string): PoLine {
  return {
    lineId: be.lineId,
    poId,
    skuId: be.sku,
    description: be.description ?? undefined,
    orderedQty: be.quantityOrdered,
    receivedQty: be.quantityReceived,
    openQuantity: be.openQuantity,
    unitPrice: be.unitPrice,
    currency,
    lineTotal: be.quantityOrdered * be.unitPrice,
  };
}

export function mapBePoToFe(be: BePurchaseOrderDto): PurchaseOrder {
  return {
    poId: be.purchaseOrderId,
    poNumber: be.poNumber,
    supplierId: be.supplierId,
    status: be.status,
    currency: be.currency,
    orderDate: toLocalIsoDate(be.createdAt),
    expectedDate: be.expectedAt ?? "",
    createdBy: be.createdBy ?? "",
    rejectionReason: be.cancellationReason ?? be.closeShortReason ?? undefined,
    grandTotal: be.totalAmount,
    paymentTermDays: be.paymentTermDays,
    leadTimeDays: be.leadTimeDays,
    sentAt: be.sentAt ?? undefined,
    supplierConfirmationStatus: be.supplierConfirmationStatus,
    supplierRespondedAt: be.supplierRespondedAt ?? undefined,
    supplierReference: be.supplierReference ?? undefined,
    supplierResponseNote: be.supplierResponseNote ?? undefined,
    deliveryStatus: be.deliveryStatus,
    lines: be.lines.map((l) => mapLine(l, be.purchaseOrderId, be.currency)),
  };
}
