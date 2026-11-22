import { useQuery } from "@tanstack/react-query";

import { PUTAWAY_QUERY_KEYS } from "@/constants";
import { createDetailQuery, createQueryKeys } from "@/lib/api/query-factory";

import { getCurrentTrip, getTrip } from "./trip-api";

import type { PutawayTrip } from "./types";

export const tripKeys = {
  ...createQueryKeys(PUTAWAY_QUERY_KEYS.trips),
  current: () => [PUTAWAY_QUERY_KEYS.trips, "current"] as const,
};

/** Chỗ giữ và trạng thái thùng đổi theo thao tác của người khác / bộ quét hết hạn (BR-16) — luôn đọc mới. */
export function useCurrentTrip(enabled = true) {
  return useQuery<PutawayTrip | null>({
    queryKey: tripKeys.current(),
    queryFn: ({ signal }) => getCurrentTrip(signal),
    staleTime: 0,
    enabled,
  });
}

export const useTrip = createDetailQuery<PutawayTrip>(tripKeys, getTrip, { staleTime: 0 });
