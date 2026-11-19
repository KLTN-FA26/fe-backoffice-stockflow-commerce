/**
 * Domain utilities — re-export barrel.
 */

export { canTransition, isTerminal, allowedTransitions } from "./lifecycle";
export {
  PRODUCT_TRANSITIONS,
  SKU_TRANSITIONS,
  RECEIPT_TRANSITIONS,
  QC_TRANSITIONS,
  PUTAWAY_TRANSITIONS,
  PICK_TRANSITIONS,
  PACK_TRANSITIONS,
  LOAD_TRANSITIONS,
  MOVE_TRANSITIONS,
} from "./lifecycle";
