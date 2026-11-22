import { PUTAWAY_QUERY_KEYS } from "@/constants";
import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import { getPutawayTask, listPutawayTasks } from "./api";

import type { ListPutawayParams } from "./api";
import type { PutawayTask, PutawayTaskPage } from "./types";

export const putawayKeys = createQueryKeys<ListPutawayParams>(PUTAWAY_QUERY_KEYS.all);

export const usePutawayTasks = createListQuery<PutawayTask, ListPutawayParams, PutawayTaskPage>(
  putawayKeys,
  listPutawayTasks,
);

/**
 * Bin gợi ý đổi theo tồn lúc xem (docs 05 BR-03) — không giữ cache cũ: mỗi lần mở màn cất là tính lại.
 */
export const usePutawayTask = createDetailQuery<PutawayTask>(putawayKeys, getPutawayTask, {
  staleTime: 0,
});
