import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

import { PAGE_SIZE, PRODUCER_STATUSES, STORAGE_KEYS } from "@/constants";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { usePageConfig } from "@/hooks/use-page-config";

import { useProducers } from "@/features/producer/queries";

import { LIST_PAGE_SIZE_OPTIONS } from "@/components/backoffice/ServerTableBody";

interface ProducerPageConfig {
  pageSize: number;
}

const DEFAULT_CONFIG: ProducerPageConfig = { pageSize: PAGE_SIZE.md };

const mergeConfig = (
  stored: Partial<ProducerPageConfig>,
  fallback: ProducerPageConfig,
): ProducerPageConfig => ({
  pageSize:
    stored.pageSize && LIST_PAGE_SIZE_OPTIONS.includes(stored.pageSize)
      ? stored.pageSize
      : fallback.pageSize,
});

/** State danh sách đơn vị sản xuất — trang, tìm kiếm, trạng thái trên URL; số dòng / trang ở localStorage. */
export function useProducerListState(canRead: boolean) {
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [q, setQ] = useQueryState("q", parseAsString.withDefault(""));
  const [status, setStatus] = useQueryState("status", parseAsStringLiteral(PRODUCER_STATUSES));
  const debouncedQ = useDebouncedValue(q, 300);
  const { config, updateConfig } = usePageConfig(
    STORAGE_KEYS.adminProducersConfig,
    DEFAULT_CONFIG,
    mergeConfig,
  );
  const query = useProducers(
    {
      page: Math.max(0, page - 1),
      size: config.pageSize,
      q: debouncedQ,
      status: status ?? undefined,
    },
    { enabled: canRead },
  );

  const withPageReset =
    <T>(setter: (value: T) => unknown) =>
    (value: T) => {
      void setter(value);
      void setPage(1);
    };

  return {
    canRead,
    query,
    pageSize: config.pageSize,
    q,
    status,
    hasFilters: q.trim() !== "" || status !== null,
    setPage: (zeroBased: number) => void setPage(zeroBased + 1),
    setQ: withPageReset((value: string) => setQ(value || null)),
    setStatus: withPageReset(setStatus),
    changePageSize: (pageSize: number) => {
      updateConfig((current) => ({ ...current, pageSize }));
      void setPage(1);
    },
    clearFilters: () => {
      void setQ(null);
      void setStatus(null);
      void setPage(1);
    },
  };
}

export type ProducerListState = ReturnType<typeof useProducerListState>;
