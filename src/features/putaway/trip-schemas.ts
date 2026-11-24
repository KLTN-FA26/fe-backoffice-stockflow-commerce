/**
 * Chuyến cất hàng — zod DTO + Input, khớp BE `PutawayTripController` (docs 05 §4.5, BR-15/16/17).
 */

import { z } from "zod";

import {
  PUTAWAY_FIELD_MESSAGES,
  PUTAWAY_LIMITS,
  PUTAWAY_TRIP_ITEM_STATUSES,
  PUTAWAY_TRIP_STATUSES,
} from "@/constants";

/**
 * BE `PutawayTripResponse.Carton`. `assignedLocationCode` / `stopSequence` chỉ có sau khi đi. `holding`: thùng còn
 * giữ chỗ ở bin gán — chỗ giữ tự nhả sau 30 phút không thao tác (BR-16).
 */
export const beTripCartonSchema = z.object({
  putawayTaskId: z.string(),
  lpn: z.string(),
  sku: z.string(),
  lotNumber: z.string().nullish(),
  status: z.enum(PUTAWAY_TRIP_ITEM_STATUSES),
  assignedLocationCode: z.string().nullish(),
  stopSequence: z.number().int().nullish(),
  holding: z.boolean(),
  loadedAt: z.string(),
  placedAt: z.string().nullish(),
});

/** BE `PutawayTripResponse.Point` — một điểm trên Kho Map, đơn vị mét. */
export const beTripPointSchema = z.object({ x: z.number(), y: z.number() });

/**
 * BE `PutawayTripResponse.Stop` — điểm dừng theo lộ trình láng giềng gần nhất (BR-17: chỉ để tham khảo).
 * `path` (BE #410): đường đi tới điểm này, gồm cả hai đầu — từ điểm gốc (điểm 1) hoặc điểm dừng có toạ độ ngay trước,
 * vòng qua kệ / tường / cửa đóng; ước lượng từ bản đồ vì kho chưa khai báo lối đi (docs 05 §4.5 bước 14, ⚠️ C46).
 * Vắng / null khi không có lối hoặc thiếu toạ độ → vẽ đoạn thẳng. `.nullish()` để vẫn đọc được BE chưa có trường.
 */
export const beTripStopSchema = z.object({
  sequence: z.number().int(),
  locationCode: z.string(),
  x: z.number().nullish(),
  y: z.number().nullish(),
  lpns: z.array(z.string()),
  path: z.array(beTripPointSchema).nullish(),
});

/** BE `PutawayTripResponse`. `stops` rỗng trừ khi IN_PROGRESS; `closedBy` chỉ có khi CLOSED. */
export const beTripSchema = z.object({
  id: z.string(),
  warehouseId: z.string(),
  operatorId: z.string(),
  status: z.enum(PUTAWAY_TRIP_STATUSES),
  startLocationCode: z.string().nullish(),
  startX: z.number().nullish(),
  startY: z.number().nullish(),
  /**
   * Nơi BE sắp các điểm dừng còn lại (BE #410): bin của thùng cất gần nhất, chưa cất thùng nào thì là khu nguồn.
   * Trùng `stops[0].path[0]`; chỉ có khi chuyến đang đi.
   */
  originLocationCode: z.string().nullish(),
  originX: z.number().nullish(),
  originY: z.number().nullish(),
  startedAt: z.string().nullish(),
  lastActivityAt: z.string(),
  closedAt: z.string().nullish(),
  closedBy: z.string().nullish(),
  cartons: z.array(beTripCartonSchema),
  stops: z.array(beTripStopSchema).default([]),
});

/**
 * `GET /putaway-trips/current`: không có chuyến mở → envelope không có `data` (ApiResponse NON_NULL), client đọc
 * thành `null` (lib/api, 5f7e7707).
 */
export const beCurrentTripSchema = beTripSchema.nullable();

const lpnField = z
  .string()
  .trim()
  .min(1, PUTAWAY_FIELD_MESSAGES.lpnRequired)
  .max(PUTAWAY_LIMITS.lpnMax, PUTAWAY_FIELD_MESSAGES.lpnTooLong);

/** BE `PutawayTripRequests.Load` — `lpn` @NotBlank @Size(max = 30). */
export const tripLoadInputSchema = z.object({ lpn: lpnField });

/**
 * BE `PutawayTripRequests.Place` — bin + LPN, nguyên thùng (BR-08). Bin khác bin gán vẫn được nếu nhận thùng; không
 * lý do (BR-07).
 */
export const tripPlaceInputSchema = z.object({
  locationCode: z
    .string()
    .trim()
    .min(1, PUTAWAY_FIELD_MESSAGES.locationRequired)
    .max(PUTAWAY_LIMITS.codeMax, PUTAWAY_FIELD_MESSAGES.codeTooLong),
  lpn: lpnField,
});
