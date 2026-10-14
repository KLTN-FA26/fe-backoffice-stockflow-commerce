import { useQuery } from "@tanstack/react-query";

import { QUERY_TIMES } from "@/lib/api/query-client";
import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import {
  getDashboard,
  getPrintFile,
  getProductionOrder,
  listMaterialIssues,
  listOverdue,
  listProductionOrders,
  listQcRounds,
  listScrap,
} from "./api";
import {
  getDispatchNote,
  getSettlement,
  listSubcontractRecalls,
  listSubcontractReceipts,
} from "./subcontract-flow-api";

import { getApprovedSample, getPackingLocations, getPendingIssue } from "./reference-api";

import type { ListProductionParams } from "./api";
import type { ProductionDetail, ProductionRow } from "./types";

export const productionKeys = createQueryKeys<ListProductionParams>("production-orders");

export const useProductionOrders = createListQuery<ProductionRow, ListProductionParams>(
  productionKeys,
  listProductionOrders,
);
export const useProductionOrder = createDetailQuery<ProductionDetail>(
  productionKeys,
  getProductionOrder,
);

/** Dữ liệu con của một LSX — key nằm dưới `detail(id)` để invalidate theo cả LSX. */
function useSub<T>(
  id: string,
  name: string,
  fn: (id: string, signal?: AbortSignal) => Promise<T>,
  enabled = true,
) {
  return useQuery({
    queryKey: [...productionKeys.detail(id), name],
    queryFn: ({ signal }) => fn(id, signal),
    enabled,
    ...QUERY_TIMES.detail,
  });
}

export const usePrintFile = (id: string, enabled = true) =>
  useSub(id, "print-file", getPrintFile, enabled);
export const useMaterialIssues = (id: string, enabled = true) =>
  useSub(id, "material-issues", listMaterialIssues, enabled);
export const useQcRounds = (id: string, enabled = true) =>
  useSub(id, "qc-results", listQcRounds, enabled);
export const useScrap = (id: string, enabled = true) => useSub(id, "scrap", listScrap, enabled);
export const useDispatchNote = (id: string, enabled = true) =>
  useSub(id, "dispatch-note", getDispatchNote, enabled);
export const useSubcontractReceipts = (id: string, enabled = true) =>
  useSub(id, "subcontract-receipts", listSubcontractReceipts, enabled);
export const useSubcontractRecalls = (id: string, enabled = true) =>
  useSub(id, "subcontract-recalls", listSubcontractRecalls, enabled);
export const useSettlement = (id: string, enabled = true) =>
  useSub(id, "settlement", getSettlement, enabled);
export const usePendingIssue = (id: string, enabled = true) =>
  useSub(id, "material-issues-pending", getPendingIssue, enabled);
export const useApprovedSample = (id: string, enabled = true) =>
  useSub(id, "approved-sample", getApprovedSample, enabled);
export const usePackingLocations = (id: string, enabled = true) =>
  useSub(id, "packing-locations", getPackingLocations, enabled);

export function useProductionDashboard(params: {
  from?: string;
  to?: string;
  basis?: "ACTIVITY" | "CREATED";
}) {
  return useQuery({
    queryKey: [...productionKeys.all, "dashboard", params],
    queryFn: ({ signal }) => getDashboard(params, signal),
    ...QUERY_TIMES.dashboard,
  });
}

export function useOverdueProduction() {
  return useQuery({
    queryKey: [...productionKeys.all, "overdue"],
    queryFn: ({ signal }) => listOverdue(signal),
    ...QUERY_TIMES.dashboard,
  });
}
