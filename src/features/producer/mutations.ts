/**
 * Mutation danh mục đơn vị sản xuất + invalidation (api-conventions §2.3): mọi thay đổi làm mới `sales-producers`
 * (danh sách, chi tiết và ô chọn đơn vị của Đơn sản xuất cùng root). Lỗi hiện trong dialog → tắt toast lỗi.
 */

import { PRODUCTION_TOAST_MESSAGES } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";
import { withStaleRefetch } from "@/lib/api/stale-refetch";

import { createProducer, updateProducer } from "./api";
import { isStaleProducerError } from "./errors";
import { producerKeys } from "./queries";

const ROOT = [producerKeys.all];
const base = { invalidate: ROOT, showErrorToast: false } as const;

export const useCreateProducer = createMutation(createProducer, {
  ...base,
  successMessage: PRODUCTION_TOAST_MESSAGES.producerCreated,
});

export const useUpdateProducer = withStaleRefetch(
  createMutation(updateProducer, {
    ...base,
    successMessage: PRODUCTION_TOAST_MESSAGES.producerUpdated,
  }),
  ROOT,
  isStaleProducerError,
);
