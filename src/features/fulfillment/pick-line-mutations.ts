/**
 * Dòng lấy hàng — mutation + invalidation map (api-conventions §2.3).
 *
 * - Đổi dòng + task → `fulfillmentKeys.all` (dòng nằm dưới nhánh này).
 * - Xác nhận dòng: BE trừ tồn cùng transaction (inventory :: consumption, SCRUM-275) → tồn kho
 *   (`SHARED_QUERY_ROOTS.inventoryStock`, không import chéo feature Inventory).
 * - Báo thiếu: đơn sang ON_HOLD (INVENTORY), không trừ tồn → thêm dữ liệu đơn.
 * - Phân bổ lại: giữ chỗ chuyển sang bin khác, hết dòng thiếu thì đơn hết giữ → đơn + tồn.
 * - Lấy bổ sung (top-up): thêm dòng vào task, có thể release đơn đang chờ hàng → task + đơn.
 * - Không toast lỗi mặc định: màn gắn lỗi về ô (`confirmLineError` / `shortPickError`) hoặc toast câu riêng
 *   (`reallocateError`). Lỗi dữ liệu cũ (dòng đã đổi ở máy khác, task đổi trạng thái) → tải lại.
 */

import { SHARED_QUERY_ROOTS, TOAST_MESSAGES } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";
import { toast } from "@/components/shared/Toast";

import { startPicking } from "./api";
import { fulfillmentErrorMessage } from "./errors";
import { TASK_AND_ORDER_KEYS, withStaleRefetch } from "./mutations";
import { confirmPickLine, reallocateShortLine, reportShortPick, topUpTask } from "./pick-line-api";
import { fulfillmentKeys } from "./queries";

import type {
  ConfirmPickLineInput,
  FulfillmentTask,
  PickLine,
  ReallocateShortLineInput,
  ReportShortPickInput,
} from "./types";

const INVENTORY_KEY = [SHARED_QUERY_ROOTS.inventoryStock] as const;

export const useConfirmPickLine = withStaleRefetch(
  createMutation<ConfirmPickLineInput, PickLine>(confirmPickLine, {
    invalidate: [fulfillmentKeys.all, INVENTORY_KEY],
    showErrorToast: false,
  }),
);

export const useReportShortPick = withStaleRefetch(
  createMutation<ReportShortPickInput, PickLine>(reportShortPick, {
    invalidate: TASK_AND_ORDER_KEYS,
    showErrorToast: false,
  }),
);

export const useReallocateShortLine = withStaleRefetch(
  createMutation<ReallocateShortLineInput, PickLine[]>(reallocateShortLine, {
    invalidate: [...TASK_AND_ORDER_KEYS, INVENTORY_KEY],
    successMessage: TOAST_MESSAGES.fulfillment.lineReallocated,
    showErrorToast: false,
  }),
);

/**
 * Lấy bổ sung (docs 07 §4.3 bước 7): dòng mới của task, có thể đổi trạng thái đơn (đơn chờ hàng đủ hàng → release →
 * Đang lấy hàng) → làm mới task, dòng và đơn. Lỗi hiện qua toast theo ngữ cảnh "topUp".
 */
export const useTopUpTask = withStaleRefetch(
  createMutation<string, PickLine[]>(topUpTask, {
    invalidate: TASK_AND_ORDER_KEYS,
    successMessage: TOAST_MESSAGES.fulfillment.toppedUp,
    showErrorToast: false,
    onError: (error) => toast.error(fulfillmentErrorMessage(error, "topUp")),
  }),
);

/**
 * Lập dòng cho task đang lấy hàng chưa có dòng (bắt đầu trước SCRUM-267): BE `startPicking` trên task PICKING
 * chỉ gọi `planLines`, không đổi gì khác — nên toast riêng, không phải "đã bắt đầu lấy hàng".
 */
export const usePlanPickLines = withStaleRefetch(
  createMutation<string, FulfillmentTask>(startPicking, {
    invalidate: [fulfillmentKeys.all],
    successMessage: TOAST_MESSAGES.fulfillment.linesPlanned,
    showErrorToast: false,
  }),
);
