/**
 * Domain utilities — re-export barrel.
 */

export { canTransition, isTerminal, allowedTransitions } from "./lifecycle";
export {
  PRODUCT_TRANSITIONS,
  SKU_TRANSITIONS,
  PO_TRANSITIONS,
  RECEIPT_TRANSITIONS,
  QC_TRANSITIONS,
  INVOICE_TRANSITIONS,
  PUTAWAY_TRANSITIONS,
  PICK_TRANSITIONS,
  PACK_TRANSITIONS,
  LOAD_TRANSITIONS,
  TRANSFER_TRANSITIONS,
  MOVE_TRANSITIONS,
} from "./lifecycle";
