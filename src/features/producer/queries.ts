import { SHARED_QUERY_ROOTS } from "@/constants";
import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import { getProducer, listProducers } from "./api";

import type { ListProducerParams } from "./api";
import type { Producer } from "./types";

/**
 * Khoá gốc `sales-producers` (= mã resource BE). Ô chọn / tra tên đơn vị của Đơn sản xuất (`lib/references`) nằm dưới
 * cùng root nên mọi mutation ở đây làm mới cả hai qua `all`.
 */
export const producerKeys = createQueryKeys<ListProducerParams>(SHARED_QUERY_ROOTS.producers);

export const useProducers = createListQuery<Producer, ListProducerParams>(
  producerKeys,
  listProducers,
);

export const useProducer = createDetailQuery<Producer>(producerKeys, getProducer);
