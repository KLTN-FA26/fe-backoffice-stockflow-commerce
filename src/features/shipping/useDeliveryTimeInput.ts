"use client";

import { useState } from "react";

import { deliveredAtToSend, deliveryTimeProblem, toLocalInput } from "./delivery-time";

/**
 * Trạng thái ô thời điểm giao của hộp thoại ghi nhận / sửa kết quả giao: mặc định lúc mở hộp thoại, chỉ gửi `deliveredAt`
 * khi người dùng đã sửa (docs 09 §4.3 bước 2). `active` = false khi kết quả không phải "đã giao" → không lỗi, không gửi.
 */
export function useDeliveryTimeInput(handedOverAt: string | null | undefined, active: boolean) {
  const [opened] = useState(() => new Date());
  const [local, setLocal] = useState(() => toLocalInput(opened));
  const [edited, setEdited] = useState(false);
  return {
    local,
    opened,
    problem: active ? deliveryTimeProblem(local, { handedOverAt }) : null,
    onChange: (next: string) => {
      setLocal(next);
      setEdited(true);
    },
    toSend: () => (active ? deliveredAtToSend(local, edited) : undefined),
  };
}
