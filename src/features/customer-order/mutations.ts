import { createMutation } from "@/lib/api/query-factory";

import { reorder } from "./api";

/** = `quoteKeys.all` — khai báo lại để không import chéo feature quote. */
const QUOTE_ROOT_KEY = ["quotes"] as const;

/** Đặt lại → yêu cầu báo giá mới cho Sales (R1b). Màn hình tự hiện kết quả / lỗi. */
export const useReorder = createMutation<{ orderId: string; requestId: string }, void>(reorder, {
  invalidate: [QUOTE_ROOT_KEY],
  showErrorToast: false,
});
