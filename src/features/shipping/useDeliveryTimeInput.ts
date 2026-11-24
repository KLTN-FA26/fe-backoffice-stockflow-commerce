"use client";

import { useState } from "react";

import {
  deliveredAtToSend,
  deliveryTimeProblem,
  sameBusinessDay,
  toLocalInput,
} from "./delivery-time";

/**
 * Trạng thái ô thời điểm giao của hộp thoại ghi nhận / sửa kết quả giao: mặc định lúc mở hộp thoại, chỉ gửi `deliveredAt`
 * khi người dùng đã sửa (docs 09 §4.3 bước 2). `active` = false khi kết quả không phải "đã giao" → không lỗi, không gửi.
 *
 * `undone` (audit r3 EINV-1, BE `undoneDeliveredAt`): sửa ngược một lần "giao thất bại" vốn là sửa từ "đã giao" — ô điền
 * sẵn thời điểm của lần giao bị sửa, và để nguyên (hay nhập lại đúng phút đó) thì KHÔNG gửi gì: BE tự lấy đúng thời điểm
 * cũ, kể cả giây. `otherDay`: ngày (giờ Việt Nam) đang nhập khác ngày giao cũ — thành một lần giao mới.
 */
export function useDeliveryTimeInput(
  handedOverAt: string | null | undefined,
  active: boolean,
  undone?: string | null,
) {
  const [opened] = useState(() => new Date());
  const [undoneLocal] = useState(() => (undone ? toLocalInput(undone) : null));
  const [local, setLocal] = useState(() => undoneLocal ?? toLocalInput(opened));
  const [edited, setEdited] = useState(false);
  return {
    local,
    opened,
    /** Ô đang điền theo lần giao bị sửa (BE `undoneDeliveredAt`). */
    restoresUndone: undoneLocal !== null,
    otherDay: active && undoneLocal !== null && !!local && !sameBusinessDay(local, undoneLocal),
    problem: active ? deliveryTimeProblem(local, { handedOverAt }) : null,
    onChange: (next: string) => {
      setLocal(next);
      setEdited(true);
    },
    toSend: () => (active && local !== undoneLocal ? deliveredAtToSend(local, edited) : undefined),
  };
}
