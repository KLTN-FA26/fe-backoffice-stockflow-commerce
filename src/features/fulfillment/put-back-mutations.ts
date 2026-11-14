/**
 * Cất lại thùng — mutation + invalidation map (api-conventions §2.3).
 *
 * - Đổi dòng + hàng đợi → `fulfillmentKeys.all` (dòng lấy hàng và hàng đợi nằm dưới nhánh này).
 * - BE cộng lại tồn khả dụng cùng transaction (docs 07 §4.5 bước 14) → tồn kho (`SHARED_QUERY_ROOTS.inventoryStock`).
 * - Lỗi gắn về ô / banner trong dialog (`putBackError`); thành công thì toast.
 */

import { SHARED_QUERY_ROOTS, TOAST_MESSAGES } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";
import { toast } from "@/components/shared/Toast";

import { withStaleRefetch } from "./mutations";
import { putBackLine } from "./put-back-api";
import { fulfillmentKeys } from "./queries";

import type { PickLine, PutBackLineInput } from "./types";

export const usePutBackLine = withStaleRefetch(
  createMutation<PutBackLineInput, PickLine>(putBackLine, {
    invalidate: [fulfillmentKeys.all, [SHARED_QUERY_ROOTS.inventoryStock]],
    showErrorToast: false,
    onSuccess: (line) =>
      toast.success(
        TOAST_MESSAGES.fulfillment.putBack(line.lpn, line.sku, line.putBackLocationCode ?? ""),
      ),
  }),
);
