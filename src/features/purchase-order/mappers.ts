/**
 * Purchase Order — BE wire DTO → FE view model. Thuần, không I/O.
 *
 * Đầu vào đã qua zod (`bePurchaseOrderSchema`) nên status chắc chắn là 1 trong 8 mã BE (D4).
 * Tiền tệ giữ NGUYÊN mã BE trả (vd EUR) — không âm thầm đổi thành VND.
 */

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
    uom: be.uom,
    taxRate: be.taxRate,
    lineTotal: be.lineTotal,
    status: be.status,
  };
}

export function mapBePoToFe(be: BePurchaseOrderDto): PurchaseOrder {
  return {
    poId: be.purchaseOrderId,
    poNumber: be.poNumber,
    type: be.type,
    supplierId: be.supplierId,
    supplierName: be.supplierName ?? undefined,
    warehouseId: be.warehouseId,
    warehouseName: be.warehouseName ?? undefined,
    status: be.status,
    currency: be.currency,
    orderDate: be.orderDate,
    expectedDate: be.expectedAt ?? "",
    createdBy: be.createdBy ?? "",
    rejectionReason: be.cancellationReason ?? be.closeReason ?? undefined,
    closeKind: be.closeKind ?? undefined,
    note: be.note ?? undefined,
    revisionNo: be.revisionNo,
    submittedBy: be.submittedBy ?? undefined,
    approvedBy: be.approvedBy ?? undefined,
    subtotal: be.subtotal,
    taxTotal: be.taxTotal,
    grandTotal: be.totalAmount,
    paymentTermDays: be.paymentTermDays,
    leadTimeDays: be.leadTimeDays,
    sentAt: be.sentAt ?? undefined,
    supplierConfirmationStatus: be.supplierConfirmationStatus,
    supplierRespondedAt: be.supplierRespondedAt ?? undefined,
    supplierReference: be.supplierReference ?? undefined,
    supplierResponseNote: be.supplierResponseNote ?? undefined,
    deliveryStatus: be.deliveryStatus,
    cancellationDeliveryStatus: be.cancellationDeliveryStatus,
    warnings: be.warnings,
    lines: be.lines.map((l) => mapLine(l, be.purchaseOrderId, be.currency)),
  };
}
