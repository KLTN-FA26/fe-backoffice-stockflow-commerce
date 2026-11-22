/**
 * Cất hàng — mutation + invalidation map (api-conventions §2.3).
 *
 * - Nhiệm vụ đổi sang DONE, bin gợi ý của thùng khác đổi theo chỗ vừa chiếm → `putawayKeys.all`.
 * - BE ghi tồn khả dụng cùng transaction (docs 05 BR-12) → tồn kho (`SHARED_QUERY_ROOTS.inventoryStock`).
 * - Thùng cuối của phiếu được cất → phiếu nhập In Putaway → Closed (docs 05 §4.4 bước 9).
 * - Lỗi gắn về ô / banner trên màn (`putawayConfirmError`); thành công thì toast.
 */

import { PUTAWAY_QUERY_KEYS, TOAST_MESSAGES } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";
import { toast } from "@/components/shared/Toast";

import { confirmPutaway } from "./api";
import { putawayKeys } from "./queries";

import type { ConfirmPutawayInput, PutawayTask } from "./types";

export const useConfirmPutaway = createMutation<ConfirmPutawayInput, PutawayTask>(confirmPutaway, {
  invalidate: [putawayKeys.all, [PUTAWAY_QUERY_KEYS.stock], [PUTAWAY_QUERY_KEYS.receipts]],
  showErrorToast: false,
  onSuccess: (task, input) =>
    toast.success(
      TOAST_MESSAGES.putaway.confirmed(
        task.lpn ?? input.values.lpn,
        task.targetLocationCode ?? input.values.locationCode,
      ),
    ),
});
