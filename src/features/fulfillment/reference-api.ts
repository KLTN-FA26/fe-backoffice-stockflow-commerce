/**
 * Dữ liệu phụ trợ của module khác mà màn xuất kho cần — task BE chỉ trả id.
 *
 * - Số đơn và dòng hàng đi kèm task (SCRUM-466), không tra đơn hàng ở đây.
 * - Đơn chờ đưa vào xuất kho (`GET /fulfillment/task-candidates`): cần `fulfillment-task-assignment:CREATE`
 *   — quản lý kho chọn đơn để tạo task mà không cần `sales-orders:READ` (BE PR #151).
 * - Người nhận task (`GET /fulfillment/assignees?warehouseId=`): danh sách chọn trong dialog gán / tạo
 *   task. Cần `fulfillment-task-assignment:UPDATE` — cùng quyền với việc gán, nên ai gán được thì thấy
 *   danh sách (không cần `identity-users:READ`). Tên người được gán trên task lấy từ `assignedUserName`.
 * Thiếu quyền → màn hình không gọi, hiện thông báo (xem `components`). Không import
 * `features/order` (import boundary) — parse bằng schema nhỏ của feature này.
 */

import { PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";

import { assigneeListSchema, taskCandidatePageSchema } from "./schemas";

import type { Assignee, TaskCandidatePage } from "./types";

const ASSIGNEES_PATH = "/fulfillment/assignees";
const TASK_CANDIDATES_PATH = "/fulfillment/task-candidates";

/**
 * Đơn đưa được vào xuất kho (BE `GET /fulfillment/task-candidates`, guard
 * `fulfillment-task-assignment:CREATE`): chỉ đơn READY_TO_FULFILL chưa có task — đơn CONFIRMED phải
 * release trước (BE PR #133, FulfillmentServiceImpl#createTask) — cũ nhất trước. Không cần
 * `sales-orders:READ`. Bỏ `warehouseId` thì người gọi bị giới hạn kho nhận mọi kho của mình.
 */
export async function listTaskCandidates(
  params: { warehouseId?: string } = {},
  signal?: AbortSignal,
): Promise<TaskCandidatePage> {
  const { data } = await api.get<unknown>(TASK_CANDIDATES_PATH, {
    // Một trang tối đa của BE (Pages.MAX_PAGE_SIZE = 200) — ô chọn chưa có tìm kiếm / phân trang
    params: { page: 0, size: PAGE_SIZE.masterData, warehouseId: params.warehouseId },
    signal,
  });
  return taskCandidatePageSchema.parse(data);
}

/** Tên hiển thị của người nhận; thiếu tên thì id. */
export function assigneeName(user: Pick<Assignee, "userId" | "displayName">): string {
  return user.displayName || user.userId;
}

/**
 * Người nhận được task của một kho (BE `GET /fulfillment/assignees`): nhân viên kho / quản lý kho đang
 * hoạt động được gán cho kho đó, xếp theo tên.
 */
export async function listAssignees(
  warehouseId: string,
  signal?: AbortSignal,
): Promise<Assignee[]> {
  const { data } = await api.get<unknown>(ASSIGNEES_PATH, { params: { warehouseId }, signal });
  return [...assigneeListSchema.parse(data)].sort((a, b) =>
    assigneeName(a).localeCompare(assigneeName(b), "vi"),
  );
}
