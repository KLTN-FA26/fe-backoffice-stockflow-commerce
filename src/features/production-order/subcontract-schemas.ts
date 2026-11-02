/** Gia công ngoài — DTO phiếu giao, lần nhận, thu hồi, quyết toán (BE d215f6e SubcontractService). */

import { z } from "zod";

import { SUBCONTRACT_METHODS } from "./schemas";

export const dispatchNoteDtoSchema = z.object({
  orderNumber: z.string(),
  method: z.enum(SUBCONTRACT_METHODS),
  purchaseOrderId: z.string(),
  purchaseOrderNumber: z.string(),
  purchaseOrderStatus: z.string(),
  subcontractorCode: z.string(),
  subcontractorName: z.string(),
  blankSku: z.string(),
  quantity: z.number().int(),
  dueDate: z.string().nullish(),
  expectedDate: z.string().nullish(),
  designChecksum: z.string(),
  prepressCheckedAt: z.string(),
  blanks: z.array(
    z.object({
      sku: z.string(),
      lotNumber: z.string().nullish(),
      fromLocation: z.string(),
      toLocation: z.string(),
      quantity: z.number().int(),
      sentAt: z.string(),
    }),
  ),
});

export const subcontractReceiptDtoSchema = z.object({
  receiptId: z.string(),
  quantity: z.number().int(),
  receivedAt: z.string(),
  usedBlanks: z.number().int().nullish(),
  spoiltBlanks: z.number().int().nullish(),
  returnedBlanks: z.number().int().nullish(),
  reconciledAt: z.string().nullish(),
});

export const subcontractRecallDtoSchema = z.object({
  id: z.string(),
  returned: z.number().int(),
  spoilt: z.number().int(),
  returnLocation: z.string().nullish(),
  note: z.string().nullish(),
  recordedAt: z.string(),
});

export const settlementDtoSchema = z.object({
  purchaseOrderId: z.string(),
  status: z.enum(["AWAITING_APPROVAL", "FINAL"]),
  currency: z.string(),
  unitPrice: z.number(),
  receivedQuantity: z.number().int(),
  passedQuantity: z.number().int(),
  failedQuantity: z.number().int(),
  payableAmount: z.number(),
  blanksSent: z.number().int(),
  blanksUsed: z.number().int(),
  blanksReturned: z.number().int(),
  blanksLost: z.number().int(),
  tolerancePercent: z.number(),
  toleranceBlanks: z.number().int(),
  excessLoss: z.number().int(),
  deductionPerBlank: z.number().nullish(),
  deductionAmount: z.number().nullish(),
  cancellationFee: z.number().nullish(),
  cancellationFeeReason: z.string().nullish(),
  netPayable: z.number(),
  approvalNote: z.string().nullish(),
});
