"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

import { PAGE_SIZE } from "@/constants";
import { useAuthStore } from "@/lib/auth/auth-store";
import {
  allowedPoActions,
  usePoSuppliers,
  usePoWarehouses,
  usePurchaseOrder,
} from "@/features/purchase-order";
import { useSkus } from "@/features/product";

import { usePoActions } from "./usePoActions";

import type { PoAction } from "@/features/purchase-order";

export function usePoDetail(id: string) {
  const searchParams = useSearchParams();
  const isDuplicate = searchParams.get("duplicate") === "1";
  const roles = useAuthStore((s) => s.effectiveRoles());

  const poQuery = usePurchaseOrder(id);
  // FE-only master data (see api.ts) — a failure here must not block the PO itself.
  const suppliersQuery = usePoSuppliers({});
  const warehousesQuery = usePoWarehouses({});
  const skusQuery = useSkus({ page: 1, pageSize: PAGE_SIZE.masterData });

  const po = poQuery.data ?? null;
  const skus = useMemo(() => skusQuery.data?.items ?? [], [skusQuery.data]);
  const supplier = useMemo(
    () => suppliersQuery.data?.items.find((s) => s.supplierId === po?.supplierId) ?? null,
    [po, suppliersQuery.data],
  );
  const warehouse = useMemo(
    () => warehousesQuery.data?.items.find((w) => w.warehouseId === po?.warehouseId) ?? null,
    [po, warehousesQuery.data],
  );
  // All roles, not roles[0]: a user holding several roles gets the union of permissions.
  const actions: readonly PoAction[] = po ? allowedPoActions(po.status, roles) : [];
  const poActions = usePoActions(po, () => void poQuery.refetch());

  return {
    isDuplicate,
    poQuery,
    po,
    skus,
    supplier,
    warehouse,
    actions,
    masterDataError: suppliersQuery.isError || warehousesQuery.isError || skusQuery.isError,
    ...poActions,
  };
}
