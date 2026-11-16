import type { z } from "zod";

import type {
  buildReceiptInputSchema,
  buildRefundRecordInputSchema,
  voidInputSchema,
  voidRefundInputSchema,
} from "./input-schemas";
import type {
  installmentDtoSchema,
  installmentPageDtoSchema,
  orderInstallmentsDtoSchema,
  orderRefundDtoSchema,
  receiptDtoSchema,
  refundRecordDtoSchema,
} from "./schemas";

export type Installment = z.infer<typeof installmentDtoSchema>;
export type InstallmentPage = z.infer<typeof installmentPageDtoSchema>;
export type OrderInstallments = z.infer<typeof orderInstallmentsDtoSchema>;
export type PaymentReceipt = z.infer<typeof receiptDtoSchema>;
export type OrderRefund = z.infer<typeof orderRefundDtoSchema>;
export type RefundRecord = z.infer<typeof refundRecordDtoSchema>;

export type ReceiptInputSchema = ReturnType<typeof buildReceiptInputSchema>;
export type ReceiptFormValues = z.input<ReceiptInputSchema>;
export type ReceiptInput = z.output<ReceiptInputSchema>;
export type VoidFormValues = z.input<typeof voidInputSchema>;
export type VoidInput = z.output<typeof voidInputSchema>;
export type RefundRecordInputSchema = ReturnType<typeof buildRefundRecordInputSchema>;
export type RefundRecordFormValues = z.input<RefundRecordInputSchema>;
export type RefundRecordInput = z.output<RefundRecordInputSchema>;
export type VoidRefundInput = z.output<typeof voidRefundInputSchema>;
