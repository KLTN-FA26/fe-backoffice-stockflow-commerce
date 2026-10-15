import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import { getTransferOrder, listTransferOrders } from "./api";

import type { ListTransferParams } from "./api";
import type { TransferOrder, TransferOrderRow } from "./types";

export const transferKeys = createQueryKeys<ListTransferParams>("transfer-orders");

export const useTransferOrders = createListQuery<TransferOrderRow, ListTransferParams>(
  transferKeys,
  listTransferOrders,
);

export const useTransferOrder = createDetailQuery<TransferOrder>(transferKeys, getTransferOrder);

/**
 * Lệnh cho form sửa nháp: KHÔNG tự tải lại khi quay lại tab / có mạng lại — bản mới đổi `version`
 * làm form dựng lại, mất phần đang gõ dở mà không báo. Chỉ tải lại khi lưu gặp lỗi dữ liệu cũ
 * (mutation invalidate) — lúc đó màn sửa có thông báo. Mở form thì LUÔN tải bản mới nhất (không
 * dựng form từ cache của trang chi tiết) để lần lưu đầu không vấp OPTIMISTIC_LOCK rồi mất phần đã gõ.
 */
export const useTransferOrderForEdit = createDetailQuery<TransferOrder>(
  transferKeys,
  getTransferOrder,
  { refetchOnWindowFocus: false, refetchOnReconnect: false, refetchOnMount: "always" },
);
