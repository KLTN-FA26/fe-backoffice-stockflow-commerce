/**
 * Shipping — mutations danh mục hãng (docs 09 §4.1). Hộp thoại hiện lỗi inline (CARRIER_CODE_EXISTS, OPTIMISTIC_LOCK,
 * lỗi từng ô của BE) nên không bật toast lỗi; lỗi dữ liệu cũ (hãng đã bị đổi ở nơi khác) làm mới danh mục để lần gửi sau
 * dùng đúng `version`.
 */

import { TOAST_MESSAGES } from "@/constants";
import { createMutation } from "@/lib/api/query-factory";
import { withStaleRefetch } from "@/lib/api/stale-refetch";

import { createCarrier, updateCarrier } from "./carrier-api";
import { carrierKeys } from "./queries";

import type { Carrier, SaveCarrierInput } from "./types";

const T = TOAST_MESSAGES.shipping;
const ROOT = [carrierKeys.all];

export const useCreateCarrier = withStaleRefetch(
  createMutation<SaveCarrierInput, Carrier>(createCarrier, {
    invalidate: ROOT,
    successMessage: T.carrierCreated,
    showErrorToast: false,
  }),
  ROOT,
  ["OPTIMISTIC_LOCK"],
);

export const useUpdateCarrier = withStaleRefetch(
  createMutation<{ carrierId: string; body: SaveCarrierInput }, Carrier>(
    ({ carrierId, body }) => updateCarrier(carrierId, body),
    { invalidate: ROOT, successMessage: T.carrierUpdated, showErrorToast: false },
  ),
  ROOT,
  ["OPTIMISTIC_LOCK", "CARRIER_NOT_FOUND"],
);
