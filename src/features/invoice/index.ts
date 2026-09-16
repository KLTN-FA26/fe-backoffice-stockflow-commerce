/**
 * Invoice — feature public API.
 */

// Types
export type { Invoice, InvoiceLine, InvoiceStatus, InvoiceType, MatchResult } from "./types";

// Selectors
export {
  buildInvoiceTimeline,
  classifyLineVariance,
  collectVariances,
  computeInvoiceStats,
  formatCompactCurrency,
  formatMoney,
  invoiceStatusLabel,
  lineMatchLabel,
  shouldFlagInvoiceRow,
} from "./selectors";
export type {
  InvoiceListStats,
  InvoiceTimelineStep,
  VarianceItem,
  VarianceType,
} from "./selectors";

// Query hooks
export { invoiceKeys, useInvoice, useInvoices } from "./queries";

// API
export type { ListInvoiceParams } from "./api";
