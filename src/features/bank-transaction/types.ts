import type { z } from "zod";

import type { assignInputFor, bankTransactionDtoSchema, payableInstallmentSchema } from "./schemas";

export type BankTransaction = z.infer<typeof bankTransactionDtoSchema>;
export type BankTransactionStatus = BankTransaction["status"];
export type PayableInstallment = z.infer<typeof payableInstallmentSchema>;
export type AssignValues = z.input<ReturnType<typeof assignInputFor>>;
export type AssignBody = z.output<ReturnType<typeof assignInputFor>>;
