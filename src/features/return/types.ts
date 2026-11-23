import type { z } from "zod";

import type {
  approveInputSchema,
  cancelInputSchema,
  createReceiptInputSchema,
  custodyInputSchema,
  looseLineInputSchema,
  openInputSchema,
  proposeInputSchema,
  reasonInputSchema,
  scanInputSchema,
} from "./input-schemas";
import type {
  custodyNoteDtoSchema,
  custodyOutcomeDtoSchema,
  customerCustodyDtoSchema,
  heldCartonDtoSchema,
  expectedCartonDtoSchema,
  returnedShipmentDtoSchema,
  returnEvidenceDtoSchema,
  returnHistoryDtoSchema,
  returnLineDtoSchema,
  returnLooseLineDtoSchema,
  returnParcelDtoSchema,
  returnReceiptCartonDtoSchema,
  returnReceiptDtoSchema,
  returnReceiptRowDtoSchema,
  returnRequestDtoSchema,
  returnRowDtoSchema,
} from "./schemas";

export type ReturnRequest = z.infer<typeof returnRequestDtoSchema>;
export type ReturnRow = z.infer<typeof returnRowDtoSchema>;
export type ReturnLine = z.infer<typeof returnLineDtoSchema>;
export type ReturnEvidence = z.infer<typeof returnEvidenceDtoSchema>;
export type ReturnHistoryEntry = z.infer<typeof returnHistoryDtoSchema>;
export type ReturnReceipt = z.infer<typeof returnReceiptDtoSchema>;
export type ReturnReceiptRow = z.infer<typeof returnReceiptRowDtoSchema>;
export type ReturnReceiptCarton = z.infer<typeof returnReceiptCartonDtoSchema>;
export type ReturnLooseLine = z.infer<typeof returnLooseLineDtoSchema>;
export type ReturnParcel = z.infer<typeof returnParcelDtoSchema>;
export type ExpectedCarton = z.infer<typeof expectedCartonDtoSchema>;
export type CustomerCustodyCarton = z.infer<typeof customerCustodyDtoSchema>;
export type HeldCarton = z.infer<typeof heldCartonDtoSchema>;
export type CustodyOutcome = z.infer<typeof custodyOutcomeDtoSchema>;
export type CustodyNote = z.infer<typeof custodyNoteDtoSchema>;
export type ReturnedShipment = z.infer<typeof returnedShipmentDtoSchema>;

export type ApproveFormValues = z.input<typeof approveInputSchema>;
export type ReasonFormValues = z.input<typeof reasonInputSchema>;
export type CancelFormValues = z.input<typeof cancelInputSchema>;
export type ProposeFormValues = z.input<typeof proposeInputSchema>;
export type OpenFormValues = z.input<typeof openInputSchema>;
export type CreateReceiptFormValues = z.input<typeof createReceiptInputSchema>;
export type ScanFormValues = z.input<typeof scanInputSchema>;
export type LooseLineFormValues = z.input<typeof looseLineInputSchema>;
export type CustodyFormValues = z.input<typeof custodyInputSchema>;
