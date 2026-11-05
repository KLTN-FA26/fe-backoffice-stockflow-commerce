import { QUERY_ROOTS } from "@/lib/api/query-roots";
import { createMutation } from "@/lib/api/query-factory";

import { reorder } from "./api";

/** Đặt lại → yêu cầu báo giá mới cho Sales (R1b). Màn hình tự hiện kết quả / lỗi. */
export const useReorder = createMutation<{ orderId: string; requestId: string }, void>(reorder, {
  invalidate: [QUERY_ROOTS.quotes],
  showErrorToast: false,
});
