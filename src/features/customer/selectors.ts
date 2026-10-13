/** Selector thuần cho khách hàng — không side effect. */

import { CUSTOMER_STATUS_BY_API } from "@/constants";

import type { CustomerApiStatus, PaymentTerm } from "@/constants";
import type { CreditProfile } from "./types";

export const PAYMENT_TERM_LABEL: Readonly<Record<PaymentTerm, string>> = {
  PREPAID: "Trả trước",
  DEPOSIT: "Đặt cọc",
  CREDIT: "Công nợ",
};

export function customerStatusLabel(status: CustomerApiStatus): string {
  return CUSTOMER_STATUS_BY_API[status];
}

/** Các điều khoản đang được phép — đọc từ hồ sơ BE, không suy đoán mặc định. */
export function allowedPaymentTerms(profile: CreditProfile): PaymentTerm[] {
  const terms: PaymentTerm[] = [];
  if (profile.allowPrepaid) terms.push("PREPAID");
  if (profile.allowDeposit) terms.push("DEPOSIT");
  if (profile.allowCredit) terms.push("CREDIT");
  return terms;
}
