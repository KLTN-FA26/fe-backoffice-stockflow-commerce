/**
 * Purchase Order — BE wire DTO → FE view model. Pure, no I/O.
 *
 * Input is already zod-parsed (`bePurchaseOrderSchema`), so the status is guaranteed to be
 * one of the 7 BE values — no normalisation / legacy vocabulary lives here.
 */

import { toLocalIsoDate } from "@/lib/format";

import type { BePoLineDto, BePurchaseOrderDto } from "./schemas";
import type { Currency, PoLine, PurchaseOrder } from "./types";

const SUPPORTED_CURRENCIES: readonly Currency[] = ["VND", "USD", "CNY"];

function toCurrency(code: string): Currency {
  // formatMoney only knows these three; BE accepts any ISO code (PO may be USD — BR-07 docs 02).
  return SUPPORTED_CURRENCIES.find((c) => c === code) ?? "VND";
}

function mapLine(be: BePoLineDto, poId: string, currency: Currency): PoLine {
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
  const currency = toCurrency(be.currency);
  return {
    poId: be.purchaseOrderId,
    poNumber: be.poNumber,
    supplierId: be.supplierId,
    warehouseId: null,
    status: be.status,
    currency,
    orderDate: toLocalIsoDate(be.createdAt),
    expectedDate: be.expectedAt ?? "",
    createdBy: be.createdBy ?? "",
    rejectionReason: be.cancellationReason ?? be.closeShortReason ?? undefined,
    grandTotal: be.totalAmount,
    lines: be.lines.map((l) => mapLine(l, be.purchaseOrderId, currency)),
  };
}
