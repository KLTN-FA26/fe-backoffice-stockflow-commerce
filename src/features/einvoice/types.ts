import type { z } from "zod";

import type {
  adjustInputSchema,
  agreementInputSchema,
  drawUpInputSchema,
  errorNoticeInputSchema,
  providerAccountInputSchema,
  registerRangeInputSchema,
  replaceInputSchema,
  reviseDraftInputSchema,
  seriesInputSchema,
  voidDraftInputSchema,
} from "./input-schemas";
import type {
  einvoiceDtoSchema,
  einvoiceLineDtoSchema,
  einvoiceListItemDtoSchema,
  einvoiceProviderDtoSchema,
  einvoiceSettingsDtoSchema,
  errorNoticeDtoSchema,
  fileLinkDtoSchema,
  providerCallDtoSchema,
  registerEntryDtoSchema,
} from "./schemas";

export type EInvoice = z.infer<typeof einvoiceDtoSchema>;
export type EInvoiceLine = z.infer<typeof einvoiceLineDtoSchema>;
export type EInvoiceListItem = z.infer<typeof einvoiceListItemDtoSchema>;
export type ProviderCall = z.infer<typeof providerCallDtoSchema>;
export type FileLink = z.infer<typeof fileLinkDtoSchema>;
export type ErrorNotice = z.infer<typeof errorNoticeDtoSchema>;
export type RegisterEntry = z.infer<typeof registerEntryDtoSchema>;
export type EInvoiceSettings = z.infer<typeof einvoiceSettingsDtoSchema>;
export type EInvoiceProvider = z.infer<typeof einvoiceProviderDtoSchema>;

export type VoidDraftInput = z.output<typeof voidDraftInputSchema>;
export type ReviseDraftFormValues = z.input<typeof reviseDraftInputSchema>;
export type ReviseDraftInput = z.output<typeof reviseDraftInputSchema>;
export type AdjustInput = z.output<typeof adjustInputSchema>;
export type ReplaceInput = z.output<typeof replaceInputSchema>;
export type AgreementInput = z.output<typeof agreementInputSchema>;
export type ErrorNoticeFormValues = z.input<typeof errorNoticeInputSchema>;
export type ErrorNoticeInput = z.output<typeof errorNoticeInputSchema>;
export type DrawUpInput = z.output<typeof drawUpInputSchema>;
export type ProviderAccountInput = z.output<typeof providerAccountInputSchema>;
export type SeriesInput = z.output<typeof seriesInputSchema>;
export type RegisterRange = z.output<typeof registerRangeInputSchema>;
