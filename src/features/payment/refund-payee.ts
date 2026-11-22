/**
 * BO-UX-41: who a refund goes to — the order's customer, and the bank account on the customer's legal profile — so the
 * accountant sees the payee before recording the transfer. `OrderRefundResponse` carries no customer, so it reads the
 * order (`sales-orders:READ`, the accountant has it) and the legal profile (`customer-legal-profiles:READ`). Read only;
 * a missing profile or account is shown as such, never guessed.
 */

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { QUERY_TIMES } from "@/lib/api/query-client";

const orderCustomerSchema = z.object({
  customerId: z.string().nullish(),
  customerName: z.string().nullish(),
  customerCode: z.string().nullish(),
});
const legalProfileSchema = z.object({
  companyName: z.string().nullish(),
  taxCode: z.string().nullish(),
  bankAccount: z
    .object({ accountNumber: z.string(), bankName: z.string(), accountHolder: z.string() })
    .nullish(),
});

export interface RefundPayee {
  customerName: string | null;
  taxCode: string | null;
  /** null: no legal profile, or no account on it (or no right to read it). */
  bankAccount: { accountNumber: string; bankName: string; accountHolder: string } | null;
}

export async function getRefundPayee(
  orderId: string,
  canReadProfile: boolean,
  signal?: AbortSignal,
): Promise<RefundPayee> {
  const { data } = await api.get<unknown>(`/orders/${encodeURIComponent(orderId)}`, { signal });
  const order = orderCustomerSchema.parse(data);
  let profile: z.infer<typeof legalProfileSchema> | null = null;
  if (order.customerId && canReadProfile) {
    try {
      const response = await api.get<unknown>(
        `/customers/${encodeURIComponent(order.customerId)}/legal-profile`,
        { signal },
      );
      profile = legalProfileSchema.parse(response.data);
    } catch (error) {
      if (!(error instanceof ApiError && error.code === "LEGAL_PROFILE_NOT_FOUND")) throw error;
    }
  }
  return {
    customerName: profile?.companyName ?? order.customerName ?? null,
    taxCode: profile?.taxCode ?? order.customerCode ?? null,
    bankAccount: profile?.bankAccount ?? null,
  };
}

export function useRefundPayee(orderId: string, enabled: boolean, canReadProfile: boolean) {
  return useQuery({
    queryKey: ["payment", "refund-payee", orderId, canReadProfile] as const,
    queryFn: ({ signal }) => getRefundPayee(orderId, canReadProfile, signal),
    enabled,
    ...QUERY_TIMES.detail,
  });
}
