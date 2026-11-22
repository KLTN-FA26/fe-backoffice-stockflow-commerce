/**
 * Chuyến cất hàng — mutation + invalidation map (api-conventions §2.3).
 *
 * - Mọi thao tác đổi chuyến → `tripKeys.all` (chuyến hiện tại + chi tiết).
 * - Xếp / bỏ thùng, đi, đóng đổi việc chờ cất và chỗ giữ ở bin (bin gợi ý của thùng khác) → `putawayKeys.all`.
 * - Đặt thùng ghi tồn khả dụng (BR-12) và có thể đóng phiếu nhập → tồn kho + phiếu nhập.
 * Lỗi map tại màn (`tripErrorMessage` / `putawayConfirmError`), nên tắt toast lỗi mặc định.
 */

import { PUTAWAY_QUERY_KEYS } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";

import { putawayKeys } from "./queries";
import {
  closeTrip,
  departTrip,
  forceCloseTrip,
  loadTripCarton,
  openTrip,
  placeTripCarton,
  reassignTripCarton,
  unloadTripCarton,
} from "./trip-api";
import { tripKeys } from "./trip-queries";

const TRIP = [tripKeys.all, putawayKeys.all] as const;
const STOCK = [...TRIP, [PUTAWAY_QUERY_KEYS.stock], [PUTAWAY_QUERY_KEYS.receipts]] as const;
const quiet = { showErrorToast: false } as const;

export const useOpenTrip = createMutation(openTrip, { invalidate: TRIP, ...quiet });
export const useLoadTripCarton = createMutation(loadTripCarton, { invalidate: TRIP, ...quiet });
export const useUnloadTripCarton = createMutation(unloadTripCarton, { invalidate: TRIP, ...quiet });
export const useDepartTrip = createMutation(departTrip, { invalidate: TRIP, ...quiet });
export const usePlaceTripCarton = createMutation(placeTripCarton, { invalidate: STOCK, ...quiet });
export const useReassignTripCarton = createMutation(reassignTripCarton, {
  invalidate: TRIP,
  ...quiet,
});
export const useCloseTrip = createMutation(closeTrip, { invalidate: TRIP, ...quiet });
export const useForceCloseTrip = createMutation(forceCloseTrip, { invalidate: TRIP, ...quiet });
