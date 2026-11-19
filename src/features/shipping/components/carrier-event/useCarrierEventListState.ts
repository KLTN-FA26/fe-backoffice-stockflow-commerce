import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

import {
  CARRIER_EVENT_ERRORS_FILTER,
  CARRIER_EVENT_PAGE_SIZE,
  CARRIER_EVENT_PAGE_SIZES,
  CARRIER_EVENT_RESULTS,
} from "@/constants";
import {
  CARRIER_EVENT_ALL_FILTER,
  isErrorFilter,
  resultParam,
} from "@/features/shipping/carrier-event-lifecycle";
import { useCarrierEvents } from "@/features/shipping/carrier-event-queries";

const RESULT_FILTERS = [
  CARRIER_EVENT_ERRORS_FILTER,
  CARRIER_EVENT_ALL_FILTER,
  ...CARRIER_EVENT_RESULTS,
] as const;
const HANDLING_FILTERS = ["all", "open", "done"] as const;

export type CarrierEventEmptyState =
  "none" | "no-errors" | "no-data" | "no-results" | "invalid-page";

/**
 * State màn sự kiện hãng — trang, kết quả (mặc định = danh sách lỗi), xử lý, hãng, chuyến và sự kiện đang mở nằm trên URL
 * (state-persistence.md). "Đã / chưa xử lý" chỉ có nghĩa trong danh sách lỗi nên chỉ gửi BE khi đang xem lỗi.
 */
export function useCarrierEventListState(canRead: boolean) {
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [explicitResult, setResult] = useQueryState("result", parseAsStringLiteral(RESULT_FILTERS));
  const [handling, setHandling] = useQueryState(
    "handling",
    parseAsStringLiteral(HANDLING_FILTERS).withDefault("all"),
  );
  const [rawSize, setSize] = useQueryState(
    "size",
    parseAsInteger.withDefault(CARRIER_EVENT_PAGE_SIZE),
  );
  const [carrierId, setCarrierId] = useQueryState("carrier", parseAsString.withDefault(""));
  const [loadId, setLoadId] = useQueryState("load", parseAsString.withDefault(""));
  const [eventId, setEventId] = useQueryState("event", parseAsString.withDefault(""));

  // Mở từ một chuyến (`?load=`) thì mặc định xem MỌI sự kiện của chuyến đó; chuyến khoẻ không có lỗi nào, danh sách lỗi
  // sẽ trống và trông như hỏng. Không có `?load=` thì mặc định là danh sách lỗi.
  const defaultResult = loadId ? CARRIER_EVENT_ALL_FILTER : CARRIER_EVENT_ERRORS_FILTER;
  const result = explicitResult ?? defaultResult;
  const size =
    CARRIER_EVENT_PAGE_SIZES.find((option) => option === rawSize) ?? CARRIER_EVENT_PAGE_SIZE;
  const errorView = isErrorFilter(result);
  const effectiveHandling = errorView ? handling : "all";
  const query = useCarrierEvents(
    {
      page: Math.max(0, page - 1),
      size,
      result: resultParam(result),
      open: effectiveHandling === "all" ? undefined : effectiveHandling === "open",
      carrierId: carrierId || undefined,
      loadId: loadId || undefined,
    },
    { enabled: canRead },
  );
  const filtered =
    effectiveHandling !== "all" ||
    carrierId !== "" ||
    loadId !== "" ||
    (result !== CARRIER_EVENT_ERRORS_FILTER && result !== CARRIER_EVENT_ALL_FILTER);
  const hasFilters = filtered || result !== defaultResult;
  const data = query.data;
  let emptyState: CarrierEventEmptyState = "none";
  if (data && data.totalElements === 0) {
    if (filtered) emptyState = "no-results";
    else emptyState = result === CARRIER_EVENT_ERRORS_FILTER ? "no-errors" : "no-data";
  } else if (data && data.items.length === 0) emptyState = "invalid-page";

  return {
    canRead,
    query,
    result,
    handling: effectiveHandling,
    errorView,
    size,
    resultIsDefault: result === defaultResult,
    carrierId,
    loadId,
    eventId,
    hasFilters,
    emptyState,
    setPage: (value: number) => void setPage(value),
    setResult: (value: string) => {
      const next = RESULT_FILTERS.find((known) => known === value) ?? CARRIER_EVENT_ERRORS_FILTER;
      void setResult(next === defaultResult ? null : next);
      if (!isErrorFilter(next)) void setHandling(null);
      void setPage(1);
    },
    setHandling: (value: string) => {
      void setHandling(HANDLING_FILTERS.find((known) => known === value) ?? "all");
      void setPage(1);
    },
    setCarrierId: (value: string) => {
      void setCarrierId(value);
      void setPage(1);
    },
    clearLoad: () => {
      // Giữ nguyên kết quả đang xem (mặc định ngầm của `?load=` là "Tất cả") khi bỏ lọc chuyến
      void setResult(result === CARRIER_EVENT_ERRORS_FILTER ? null : result);
      void setLoadId(null);
      void setPage(1);
    },
    clearFilters: () => {
      void setResult(null);
      void setHandling(null);
      void setCarrierId(null);
      void setLoadId(null);
      void setPage(1);
    },
    setPageSize: (value: number) => {
      void setSize(value === CARRIER_EVENT_PAGE_SIZE ? null : value);
      void setPage(1);
    },
    clearHandling: () => {
      void setHandling(null);
      void setPage(1);
    },
    clearCarrier: () => {
      void setCarrierId(null);
      void setPage(1);
    },
    clearResult: () => {
      void setResult(null);
      void setHandling(null);
      void setPage(1);
    },
    openEvent: (id: string) => void setEventId(id),
    closeEvent: () => void setEventId(null),
  };
}

export type CarrierEventListState = ReturnType<typeof useCarrierEventListState>;
