import type { z } from "zod";
import type {
  dashboardDtoSchema,
  materialIssueDtoSchema,
  printFileDtoSchema,
  productionDetailDtoSchema,
  productionRowDtoSchema,
  qcRoundDtoSchema,
  scrapDtoSchema,
  statusChangeDtoSchema,
  HOLD_REASONS,
  SCRAP_REASONS,
  SUBCONTRACT_METHODS,
} from "./schemas";
import type {
  dispatchNoteDtoSchema,
  settlementDtoSchema,
  subcontractRecallDtoSchema,
  subcontractReceiptDtoSchema,
} from "./subcontract-schemas";

export type ProductionRow = z.infer<typeof productionRowDtoSchema>;
export type ProductionDetail = z.infer<typeof productionDetailDtoSchema>;
export type StatusChange = z.infer<typeof statusChangeDtoSchema>;
export type PrintFile = z.infer<typeof printFileDtoSchema>;
export type MaterialIssue = z.infer<typeof materialIssueDtoSchema>;
export type QcRound = z.infer<typeof qcRoundDtoSchema>;
export type ScrapRecord = z.infer<typeof scrapDtoSchema>;
export type ProductionDashboard = z.infer<typeof dashboardDtoSchema>;
export type DispatchNote = z.infer<typeof dispatchNoteDtoSchema>;
export type SubcontractReceipt = z.infer<typeof subcontractReceiptDtoSchema>;
export type SubcontractRecall = z.infer<typeof subcontractRecallDtoSchema>;
export type Settlement = z.infer<typeof settlementDtoSchema>;
export type HoldReason = (typeof HOLD_REASONS)[number];
export type ScrapReason = (typeof SCRAP_REASONS)[number];
export type SubcontractMethod = (typeof SUBCONTRACT_METHODS)[number];
