/**
 * Chuyến cất hàng — API layer, khớp BE `PutawayTripController` (docs 05 §4.5). Parse tại biên; thao tác ghi gửi
 * `Idempotency-Key` khi có.
 */

import { PUTAWAY_API } from "@/constants";
import { api } from "@/lib/api/client";
import { idempotencyRequestConfig } from "@/lib/api/idempotency";

import { beCurrentTripSchema, beTripSchema } from "./trip-schemas";

import type { PutawayTrip, TripPlaceValues } from "./types";

const parse = (data: unknown): PutawayTrip => beTripSchema.parse(data);

/** Chuyến đang mở (LOADING / IN_PROGRESS) của người gọi; `null` khi không có. */
export async function getCurrentTrip(signal?: AbortSignal): Promise<PutawayTrip | null> {
  const { data } = await api.get<unknown>(PUTAWAY_API.currentTrip, { signal });
  return beCurrentTripSchema.parse(data ?? null);
}

export async function getTrip(id: string, signal?: AbortSignal): Promise<PutawayTrip> {
  const { data } = await api.get<unknown>(PUTAWAY_API.trip(id), { signal });
  return parse(data);
}

/** Mở chuyến ở một kho (LOADING). BR-15: mỗi người một chuyến mở → 409 PUTAWAY_TRIP_ALREADY_OPEN. */
export async function openTrip({
  warehouseId,
  idempotencyKey,
}: {
  warehouseId: string;
  idempotencyKey?: string;
}) {
  const { data } = await api.post<unknown>(
    PUTAWAY_API.trips,
    { warehouseId },
    idempotencyRequestConfig(idempotencyKey),
  );
  return parse(data);
}

/** Xếp một thùng chờ cất lên xe (chỉ khi LOADING); quét lại thùng đã có không đổi gì. */
export async function loadTripCarton({
  tripId,
  lpn,
  idempotencyKey,
}: {
  tripId: string;
  lpn: string;
  idempotencyKey?: string;
}) {
  const { data } = await api.post<unknown>(
    PUTAWAY_API.tripCartons(tripId),
    { lpn },
    idempotencyRequestConfig(idempotencyKey),
  );
  return parse(data);
}

export async function unloadTripCarton({ tripId, lpn }: { tripId: string; lpn: string }) {
  const { data } = await api.delete<unknown>(PUTAWAY_API.tripCarton(tripId, lpn));
  return parse(data);
}

/** Bắt đầu đi: BE gán bin, giữ chỗ, xếp lộ trình (LOADING → IN_PROGRESS; xe rỗng → 422 PUTAWAY_TRIP_EMPTY). */
export async function departTrip({ tripId }: { tripId: string }) {
  const { data } = await api.post<unknown>(PUTAWAY_API.departure(tripId));
  return parse(data);
}

/** Đặt một thùng trên xe vào bin quét được — cùng luật cứng như cất một thùng (BR-03/04/09/13). */
export async function placeTripCarton({
  tripId,
  values,
  idempotencyKey,
}: {
  tripId: string;
  values: TripPlaceValues;
  idempotencyKey?: string;
}) {
  const { data } = await api.post<unknown>(
    PUTAWAY_API.placements(tripId),
    { locationCode: values.locationCode, lpn: values.lpn },
    idempotencyRequestConfig(idempotencyKey),
  );
  return parse(data);
}

/** Đổi bin gán cho một thùng: bin xếp hạng kế tiếp, hết thì OVERFLOW — không lý do (BR-07). */
export async function reassignTripCarton({ tripId, lpn }: { tripId: string; lpn: string }) {
  const { data } = await api.post<unknown>(PUTAWAY_API.reassignment(tripId, lpn));
  return parse(data);
}

/** Đóng chuyến của mình (LOADING / IN_PROGRESS → CLOSED; thùng còn trên xe về hàng chờ). */
export async function closeTrip({ tripId }: { tripId: string }) {
  const { data } = await api.post<unknown>(PUTAWAY_API.closure(tripId));
  return parse(data);
}

/** Quản lý kho đóng chuyến bỏ dở của người khác (docs 05 §2, quyền APPROVE). */
export async function forceCloseTrip({ tripId }: { tripId: string }) {
  const { data } = await api.post<unknown>(PUTAWAY_API.forcedClosure(tripId));
  return parse(data);
}
