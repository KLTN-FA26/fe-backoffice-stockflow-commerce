"use client";

import { useState } from "react";

/**
 * Trạng thái mở của dialog thao tác đơn (huỷ / release / quyết định công nợ) — cùng cách chặn với
 * `OrderReasonDialog`. Mutation phải sống ở component mở dialog (truyền xuống form), không ở form:
 * Esc / bấm ra ngoài khi request đang chạy sẽ unmount form → mất lần thử Idempotency-Key, mở lại là
 * sinh key mới cho cùng thao tác. Nên khi `isPending` thì bỏ qua yêu cầu đóng từ Radix.
 *
 * `close` không bị chặn: gọi từ callback của `mutate` (thành công / dữ liệu cũ) — lúc đó request đã
 * có kết quả — hoặc từ nút Huỷ, vốn đã khoá khi đang gửi (`FormDialogBody`).
 */
export function usePendingSafeDialog(isPending: boolean) {
  const [open, setOpen] = useState(false);
  return {
    open,
    show: () => setOpen(true),
    close: () => setOpen(false),
    onOpenChange: (next: boolean) => {
      if (next || !isPending) setOpen(next);
    },
  };
}
