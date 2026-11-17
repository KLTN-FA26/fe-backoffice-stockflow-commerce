/** Selector thuần cho khách hàng — không side effect. */

import { CUSTOMER_STATUS_BY_API, PAYMENT_TERM_LABELS } from "@/constants";

import type { CustomerApiStatus } from "@/constants";

export const PAYMENT_TERM_LABEL = PAYMENT_TERM_LABELS;

export function customerStatusLabel(status: CustomerApiStatus): string {
  return CUSTOMER_STATUS_BY_API[status];
}
