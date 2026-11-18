import { QUERY_TIMES } from "@/lib/api/query-client";
import { createDetailQuery, createListQuery, createQueryKeys } from "@/lib/api/query-factory";

import { getCarrierEvent, listCarrierEvents } from "./carrier-event-api";

import type { ListCarrierEventParams } from "./carrier-event-api";
import type { CarrierEventDetail, CarrierEventRow } from "./carrier-event-types";

export const carrierEventKeys = createQueryKeys<ListCarrierEventParams>(
  "fulfillment-carrier-events",
);

/** Nhật ký sự kiện: lọc theo kết quả / xử lý / hãng / chuyến, phân trang ở máy chủ. */
export const useCarrierEvents = createListQuery<CarrierEventRow, ListCarrierEventParams>(
  carrierEventKeys,
  listCarrierEvents,
  // Dữ liệu do webhook đẩy về: tải lại thường xuyên hơn danh sách thường
  { ...QUERY_TIMES.tracking },
);

/**
 * Một sự kiện kèm nội dung hãng gửi. Không giữ bản cũ sau khi đóng hộp thoại (`gcTime: 0`): mở lại luôn thấy bản mới,
 * không thoáng hiện ô "đánh dấu" của một sự kiện vừa được xử lý.
 */
export const useCarrierEvent = createDetailQuery<CarrierEventDetail>(
  carrierEventKeys,
  getCarrierEvent,
  { ...QUERY_TIMES.detail, gcTime: 0, refetchOnMount: "always" },
);
