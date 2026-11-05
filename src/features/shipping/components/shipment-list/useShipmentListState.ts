import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

import { ADMIN_ROUTES, STORAGE_KEYS } from "@/constants";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { usePageConfig } from "@/hooks/use-page-config";
import { useShipments } from "@/features/shipping/queries";

import {
  DEFAULT_CONFIG,
  DEFAULT_STATUS_FILTER,
  SHIPMENT_STATUS_FILTERS,
  mergeStoredConfig,
} from "./constants";

import type { ShipmentRow } from "@/features/shipping/types";

export type ShipmentListEmptyState = "none" | "no-shipments" | "no-results" | "invalid-page";

/**
 * State danh sách lô giao — trang, tìm kiếm, trạng thái, kho, hãng nằm trên URL (nuqs), số dòng /
 * trang trong localStorage (state-persistence.md). BE nhận MỘT trạng thái; mặc định lô chờ xuất.
 */
export function useShipmentListState(canRead: boolean) {
  const router = useRouter();
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [q, setQ] = useQueryState("q", parseAsString.withDefault(""));
  const [status, setStatus] = useQueryState(
    "status",
    parseAsStringLiteral(SHIPMENT_STATUS_FILTERS).withDefault(DEFAULT_STATUS_FILTER),
  );
  const [warehouseId, setWarehouseId] = useQueryState("warehouse", parseAsString.withDefault(""));
  const [carrierId, setCarrierId] = useQueryState("carrier", parseAsString.withDefault(""));
  const debouncedQ = useDebouncedValue(q, 300);
  const { config, updateConfig } = usePageConfig(
    STORAGE_KEYS.adminShipmentsConfig,
    DEFAULT_CONFIG,
    mergeStoredConfig,
  );
  // Lô đã chọn để mở chuyến (giữ cả hàng đã chọn ở trang khác)
  const [selected, setSelected] = useState<ReadonlyMap<string, ShipmentRow>>(new Map());

  const query = useShipments(
    {
      page: Math.max(0, page - 1),
      size: config.pageSize,
      search: debouncedQ,
      status: status === "ALL" ? undefined : status,
      warehouseId: warehouseId || undefined,
      carrierId: carrierId || undefined,
    },
    { enabled: canRead },
  );

  const hasFilters =
    q.trim() !== "" || status !== DEFAULT_STATUS_FILTER || warehouseId !== "" || carrierId !== "";
  // Empty state theo tham số của dữ liệu đang hiện (search sau debounce)
  const dataFiltered =
    debouncedQ.trim() !== "" || status !== DEFAULT_STATUS_FILTER || !!warehouseId || !!carrierId;
  const data = query.data;
  let emptyState: ShipmentListEmptyState = "none";
  if (data && data.totalElements === 0) emptyState = dataFiltered ? "no-results" : "no-shipments";
  else if (data && data.items.length === 0) emptyState = "invalid-page";

  const navigateToShipment = useCallback(
    (row: ShipmentRow) => router.push(ADMIN_ROUTES.shipments.detail(row.shipmentId)),
    [router],
  );

  /** Đổi bộ lọc → về trang 1 và bỏ chọn (lô ở bộ lọc cũ không còn thấy trên màn). */
  const filter = <T>(setter: (value: T) => unknown) => {
    return (value: T) => {
      void setter(value);
      void setPage(1);
      setSelected(new Map());
    };
  };

  const onSelectionChange = (keys: Set<string>) => {
    const rows = new Map(selected);
    for (const key of [...rows.keys()]) if (!keys.has(key)) rows.delete(key);
    for (const row of data?.items ?? [])
      if (keys.has(row.shipmentId)) rows.set(row.shipmentId, row);
    setSelected(rows);
  };

  return {
    canRead,
    query,
    config,
    page,
    q,
    status,
    warehouseId,
    carrierId,
    hasFilters,
    emptyState,
    selected,
    selectedKeys: new Set(selected.keys()),
    onSelectionChange,
    clearSelection: () => setSelected(new Map()),
    setPage: (value: number) => void setPage(value),
    setQ: filter((value: string) => setQ(value)),
    setStatus: filter((value: string) =>
      setStatus(SHIPMENT_STATUS_FILTERS.find((known) => known === value) ?? DEFAULT_STATUS_FILTER),
    ),
    setWarehouseId: filter((value: string) => setWarehouseId(value || null)),
    setCarrierId: filter((value: string) => setCarrierId(value || null)),
    navigateToShipment,
    changePageSize: (pageSize: number) => {
      updateConfig((current) => ({ ...current, pageSize }));
      void setPage(1);
    },
    clearFilters: () => {
      void setQ(null);
      void setStatus(null);
      void setWarehouseId(null);
      void setCarrierId(null);
      void setPage(1);
      setSelected(new Map());
    },
  };
}

export type ShipmentListState = ReturnType<typeof useShipmentListState>;
