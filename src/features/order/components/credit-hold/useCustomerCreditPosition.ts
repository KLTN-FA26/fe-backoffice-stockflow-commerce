"use client";

import { CUSTOMER_CREDIT_PROFILE_PERMISSIONS } from "@/constants";
import { useCan } from "@/lib/auth";

import { useCreditPosition } from "../../queries";
import { isValidOrderCustomerId } from "../../schemas";

import type { CreditPositionState } from "./CreditPositionPanel";

/**
 * Công nợ hiện tại của khách cho dialog quyết định công nợ — chỉ chạy khi dialog đang mở (form chỉ
 * mount khi mở), có `customer-credit-profiles:READ` và id khách là UUID. UI-only — BE re-check
 * (@RequiresPermission customer-credit-profiles READ).
 */
export function useCustomerCreditPosition(customerId: string | null): CreditPositionState {
  const canRead = useCan(CUSTOMER_CREDIT_PROFILE_PERMISSIONS.read);
  const available = canRead && !!customerId && isValidOrderCustomerId(customerId);
  const query = useCreditPosition(customerId, { enabled: available });
  return {
    available,
    data: query.data,
    isPending: query.isPending,
    isError: query.isError,
    refetch: () => void query.refetch(),
  };
}
