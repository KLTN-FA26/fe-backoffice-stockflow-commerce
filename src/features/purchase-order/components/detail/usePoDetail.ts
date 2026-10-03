"use client";

import { useEffect, useState } from "react";
import { parseAsString, useQueryState } from "nuqs";

import { PO_PERMISSIONS, UI_LABELS } from "@/constants";
import { useCan, usePermissionChecker } from "@/lib/auth";
import { useSupplierRef } from "@/lib/references/supplier-lookup";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { allowedPoActions, usePurchaseOrder } from "@/features/purchase-order";

import { usePoActions } from "./usePoActions";

export function usePoDetail(id: string) {
  // `?duplicate=1` do form tạo gắn khi BE báo possibleDuplicate (BR-PO-003). BE chỉ tính cờ này
  // lúc tạo đơn → giữ cảnh báo cho lần xem này rồi xoá khỏi URL (history replace), để F5 / gửi
  // link không còn báo trùng mãi.
  const [duplicate, setDuplicate] = useQueryState("duplicate", parseAsString.withDefault(""));
  const [isDuplicate] = useState(() => duplicate === "1");
  useEffect(() => {
    if (duplicate) void setDuplicate(null);
  }, [duplicate, setDuplicate]);
  // READ = có được gọi API dữ liệu PO không (VIEW_PAGE đã được gate ở trang).
  const canRead = useCan(PO_PERMISSIONS.read);
  const can = usePermissionChecker();

  const poQuery = usePurchaseOrder(id, { enabled: canRead });
  const po = poQuery.data ?? null;
  // BE PurchaseOrderResponse không có tên/mã NCC — tra theo id (cả NCC đã ngừng hợp tác).
  const supplierQuery = useSupplierRef(po?.supplierId);
  // Breadcrumb hiện số PO thay vì UUID.
  useBreadcrumbLabel(id, po?.poNumber);

  const actions = po ? allowedPoActions(po, can) : [];
  const poActions = usePoActions(po, () => void poQuery.refetch());

  // Tên NCC hiện ở tiêu đề, link NCC và dialog Gửi NCC — không lộ UUID khi chưa tra được.
  const supplierName =
    supplierQuery.data?.name ??
    (supplierQuery.isError
      ? UI_LABELS.purchaseOrder.supplierUnavailable
      : UI_LABELS.purchaseOrder.supplierLoading);

  return {
    canRead,
    isDuplicate,
    poQuery,
    po,
    supplier: supplierQuery.data ?? null,
    supplierName,
    actions,
    ...poActions,
  };
}
