/**
 * Fulfillment task — selectors thuần (không side effect), derive từ dữ liệu BE trả về.
 */

import { FULFILLMENT_LIMITS, TASK_CANDIDATE_AWAITING_STOCK } from "@/constants";

import type { TaskCandidate } from "./types";

/**
 * UUID rút gọn để hiện khi BE không trả mã đọc được. Lấy phần ĐUÔI: id của BE sinh theo thời gian
 * (vd `01a12aba-ed1f-70e8-…`), phần đầu là đồng hồ nên các bản ghi tạo gần nhau trùng 8 ký tự đầu;
 * phần đuôi mới là ngẫu nhiên.
 */
export function shortId(id: string): string {
  return id.slice(-FULFILLMENT_LIMITS.shortIdLength).toUpperCase();
}

/**
 * Docs 07 §4.1 bước 2 (17 §4.4 bước 15): đơn đang chờ hàng mà Sale chưa cho giao một phần chỉ lấy trước về khu chờ xuất.
 * UI-only — Backend phải re-check (409 PICK_AWAITING_STOCK_DESTINATION).
 */
export function prePickStagingOnly(candidate: TaskCandidate | undefined): boolean {
  return (
    candidate?.orderStatus === TASK_CANDIDATE_AWAITING_STOCK && !candidate.partialShipmentAllowed
  );
}
