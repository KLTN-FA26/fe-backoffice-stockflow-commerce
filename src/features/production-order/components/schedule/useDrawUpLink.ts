import { useEffect, useState } from "react";
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";

import type { ShortDeliveryBatch } from "@/features/production-order/schedule-schemas";

/**
 * Hộp "Lập đơn sản xuất" của lịch: mở khi người dùng bấm "Lập" ở một dòng, hoặc từ link của đơn bán
 * (`?drawOrder=<đơn>&drawBatch=<đợt>`) — đúng một đợt còn thiếu khớp thì mở thẳng hộp, rồi bỏ tham số khỏi URL khi đóng.
 * Không khớp đợt nào / nhiều đợt mà không chỉ rõ đợt: để nguyên danh sách, bỏ tham số (không đoán).
 */
export function useDrawUpLink(
  shortBatches: readonly ShortDeliveryBatch[] | undefined,
  canDrawUp: boolean,
) {
  const [picked, setPicked] = useState<ShortDeliveryBatch | null>(null);
  const [link, setLink] = useQueryStates({ drawOrder: parseAsString, drawBatch: parseAsInteger });
  const matches =
    shortBatches && link.drawOrder
      ? shortBatches.filter(
          (item) =>
            item.salesOrderId === link.drawOrder &&
            (link.drawBatch === null || item.seq === link.drawBatch),
        )
      : [];
  const linked = matches.length === 1 ? (matches[0] ?? null) : null;
  const unmatched = !!shortBatches && !!link.drawOrder && !linked;
  useEffect(() => {
    if (unmatched) void setLink({ drawOrder: null, drawBatch: null });
  }, [unmatched, setLink]);
  return {
    open: picked ?? (canDrawUp ? linked : null),
    pick: setPicked,
    close: () => {
      setPicked(null);
      if (link.drawOrder) void setLink({ drawOrder: null, drawBatch: null });
    },
  };
}
