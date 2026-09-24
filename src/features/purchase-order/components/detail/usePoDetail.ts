"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { PAGE_SIZE } from "@/constants";
import { useAuthStore } from "@/lib/auth/auth-store";
import {
  allowedPoActions,
  useApprovePo,
  useCancelPo,
  useCloseShortPo,
  useReceiveGoodsPo,
  usePoSuppliers,
  usePoWarehouses,
  usePurchaseOrder,
  usePurchaseOrders,
  useSendPo,
} from "@/features/purchase-order";
import { useSkus } from "@/features/product";

import type { PoAction } from "@/features/purchase-order";

export function usePoDetail(id: string) {
  const searchParams = useSearchParams();
  const isDuplicate = searchParams.get("duplicate") === "1";
  const roles = useAuthStore((s) => s.effectiveRoles());
  const currentRole = roles[0] ?? null;

  const poQuery = usePurchaseOrder(id);
  const posQuery = usePurchaseOrders({ page: 1, pageSize: PAGE_SIZE.masterData });
  const suppliersQuery = usePoSuppliers({});
  const warehousesQuery = usePoWarehouses({});
  const skusQuery = useSkus({ page: 1, pageSize: PAGE_SIZE.masterData });

  const po = poQuery.data ?? null;
  const purchaseOrders = useMemo(() => posQuery.data?.items ?? [], [posQuery.data]);
  const suppliers = useMemo(() => suppliersQuery.data?.items ?? [], [suppliersQuery.data]);
  const warehouses = useMemo(() => warehousesQuery.data?.items ?? [], [warehousesQuery.data]);
  const skus = useMemo(() => skusQuery.data?.items ?? [], [skusQuery.data]);

  const supplier = useMemo(
    () => (po ? suppliers.find((s) => s.supplierId === po.supplierId) : null),
    [po, suppliers],
  );
  const warehouse = useMemo(
    () => (po ? warehouses.find((w) => w.warehouseId === po.warehouseId) : null),
    [po, warehouses],
  );
  const actions: readonly PoAction[] =
    po && currentRole ? allowedPoActions(po.status, currentRole) : [];
  const revisionPo = useMemo(
    () => (po ? (purchaseOrders.find((p) => p.revisionOf === po.poId) ?? null) : null),
    [po, purchaseOrders],
  );

  const approvePo = useApprovePo();
  const sendPo = useSendPo();
  const cancelPo = useCancelPo();
  const closeShortPo = useCloseShortPo();
  const receivePo = useReceiveGoodsPo();
  const isMutating =
    approvePo.isPending ||
    sendPo.isPending ||
    cancelPo.isPending ||
    closeShortPo.isPending ||
    receivePo.isPending;
  const [pendingAction, setPendingAction] = useState<PoAction | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);

  const isLoading =
    poQuery.isLoading ||
    posQuery.isLoading ||
    suppliersQuery.isLoading ||
    warehousesQuery.isLoading ||
    skusQuery.isLoading;

  return {
    isDuplicate,
    po,
    suppliers,
    warehouses,
    skus,
    supplier,
    warehouse,
    actions,
    revisionPo,
    approvePo,
    sendPo,
    cancelPo,
    closeShortPo,
    receivePo,
    isMutating,
    pendingAction,
    setPendingAction,
    confirmOpen,
    setConfirmOpen,
    receiveOpen,
    setReceiveOpen,
    conflictError,
    setConflictError,
    isLoading,
  };
}
