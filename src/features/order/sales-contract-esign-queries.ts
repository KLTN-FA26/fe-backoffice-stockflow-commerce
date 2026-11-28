import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CONTRACT_ESIGN_ERRORS, CONTRACT_ESIGN_LABELS as L } from "@/constants/contract-esign";

import { ApiError } from "@/lib/api/error";
import { QUERY_ROOTS } from "@/lib/api/query-roots";
import { salesOwnerErrorMessage } from "@/lib/references/sales-owner-access";

import { toast } from "@/components/shared/Toast";

import { orderKeys } from "./queries";
import {
  getCompanyCertificate,
  getContractRevisions,
  getContractSignatures,
  getSalesContractSummary,
  listSalesContracts,
  updateContractEsign,
} from "./sales-contract-esign-api";

import type { ContractListParams } from "./sales-contract-esign-api";

const ROOT = ["sales-contracts"] as const;
export const contractEsignKeys = {
  all: ROOT,
  list: (params: ContractListParams) => [...ROOT, "list", params] as const,
  summary: [...ROOT, "summary"] as const,
  revisions: (id: string) => [...orderKeys.all, "contract", id, "revisions"] as const,
  identity: (id: string) => [...orderKeys.all, "contract", id, "identity"] as const,
  signatures: (id: string) => [...orderKeys.all, "contract", id, "signatures"] as const,
};
export const contractEsignError = (error: unknown) =>
  salesOwnerErrorMessage(error) ??
  (error instanceof ApiError ? (CONTRACT_ESIGN_ERRORS[error.code] ?? L.failure) : L.failure);

export function useCompanyCertificate(id: string, enabled: boolean) {
  return useQuery({
    queryKey: contractEsignKeys.identity(id),
    queryFn: ({ signal }) => getCompanyCertificate(id, signal),
    enabled,
  });
}
export function useContractRevisions(id: string, enabled = true) {
  return useQuery({
    queryKey: contractEsignKeys.revisions(id),
    queryFn: ({ signal }) => getContractRevisions(id, signal),
    enabled,
  });
}
export function useContractSignatures(id: string, enabled = true) {
  return useQuery({
    queryKey: contractEsignKeys.signatures(id),
    queryFn: ({ signal }) => getContractSignatures(id, signal),
    enabled,
  });
}
export function useContractList(params: ContractListParams) {
  return useQuery({
    queryKey: contractEsignKeys.list(params),
    queryFn: ({ signal }) => listSalesContracts(params, signal),
  });
}
export function useContractSummary(enabled: boolean) {
  return useQuery({
    queryKey: contractEsignKeys.summary,
    queryFn: ({ signal }) => getSalesContractSummary(signal),
    enabled,
  });
}
export function useUpdateContractEsign() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: updateContractEsign,
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: orderKeys.all }),
        client.invalidateQueries({ queryKey: contractEsignKeys.all }),
        client.invalidateQueries({ queryKey: QUERY_ROOTS.paymentInstallments }),
      ]);
      toast.success(L.success);
    },
    onError: async () => {
      await client.invalidateQueries({ queryKey: orderKeys.all });
    },
  });
}
