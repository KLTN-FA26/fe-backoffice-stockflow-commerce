import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

import { PAGE_SIZE, PRODUCTION_ORDER_STATUSES, STORAGE_KEYS } from "@/constants";
import { usePageConfig } from "@/hooks/use-page-config";

import { useProductionOrderPage } from "@/features/production-order/queries";
import { matchesProductionOrder } from "@/features/production-order/selectors";

import { LIST_PAGE_SIZE_OPTIONS } from "@/components/backoffice/ServerTableBody";

import type { PaginatedResponse } from "@/lib/api/query-factory";
import type { ListProductionOrderParams } from "@/features/production-order/api";
import type { ProductionOrder } from "@/features/production-order/types";

interface PageConfig {
  pageSize: number;
}

const DEFAULT_CONFIG: PageConfig = { pageSize: PAGE_SIZE.md };
const mergeConfig = (stored: Partial<PageConfig>, fallback: PageConfig): PageConfig => ({
  pageSize:
    stored.pageSize && LIST_PAGE_SIZE_OPTIONS.includes(stored.pageSize)
      ? stored.pageSize
      : fallback.pageSize,
});

/**
 * Tìm trong trang: BE danh sách không có tham số tìm kiếm, nên ô search lọc trang đang có theo mã / SKU; khi đang
 * tìm, phân trang thu về một trang gồm đúng các dòng khớp (không giả vờ đếm cả danh sách, không còn nút trang trước).
 */
function narrow(page: PaginatedResponse<ProductionOrder>, q: string) {
  if (!q.trim()) return page;
  const items = page.items.filter((order) => matchesProductionOrder(order, q));
  return {
    ...page,
    items,
    totalElements: items.length,
    page: 0,
    totalPages: items.length ? 1 : 0,
    hasNext: false,
    hasPrevious: false,
  };
}

/** State danh sách Đơn sản xuất — trang, trạng thái, đơn vị, kho, tìm trong trang trên URL; số dòng ở localStorage. */
export function useProductionOrderListState(canRead: boolean) {
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [q, setQ] = useQueryState("q", parseAsString.withDefault(""));
  const [status, setStatus] = useQueryState(
    "status",
    parseAsStringLiteral(PRODUCTION_ORDER_STATUSES),
  );
  const [producerId, setProducerId] = useQueryState("producerId", parseAsString);
  const [warehouseId, setWarehouseId] = useQueryState("warehouseId", parseAsString);
  const { config, updateConfig } = usePageConfig(
    STORAGE_KEYS.adminProductionOrdersConfig,
    DEFAULT_CONFIG,
    mergeConfig,
  );
  const params: ListProductionOrderParams = {
    page: Math.max(0, page - 1),
    size: config.pageSize,
    status: status ?? undefined,
    producerId: producerId ?? undefined,
    warehouseId: warehouseId ?? undefined,
  };
  const query = useProductionOrderPage(params, {
    enabled: canRead,
    select: (data) => narrow(data, q),
  });

  const withPageReset =
    <T>(setter: (value: T) => unknown) =>
    (value: T) => {
      void setter(value);
      void setPage(1);
    };

  return {
    query,
    pageSize: config.pageSize,
    q,
    status,
    producerId,
    warehouseId,
    hasFilters: q.trim() !== "" || status !== null || producerId !== null || warehouseId !== null,
    setPage: (zeroBased: number) => void setPage(zeroBased + 1),
    setQ: withPageReset((value: string) => setQ(value || null)),
    setStatus: withPageReset(setStatus),
    setProducerId: withPageReset(setProducerId),
    setWarehouseId: withPageReset(setWarehouseId),
    changePageSize: (pageSize: number) => {
      updateConfig((current) => ({ ...current, pageSize }));
      void setPage(1);
    },
    clearFilters: () => {
      void setQ(null);
      void setStatus(null);
      void setProducerId(null);
      void setWarehouseId(null);
      void setPage(1);
    },
  };
}

export type ProductionOrderListState = ReturnType<typeof useProductionOrderListState>;
