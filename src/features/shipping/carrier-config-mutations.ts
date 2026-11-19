/**
 * Shipping — mutations cấu hình hãng tích hợp API đặt xe. Hộp thoại hãng báo lỗi inline (không toast lỗi) và tự nói phần
 * nào đã lưu, phần nào chưa; thành công không toast riêng vì thông báo "đã lưu hãng" đã có ở bước lưu hãng.
 */

import { createMutation } from "@/lib/api/query-factory";

import { replacePickupPoints, replaceServiceCodes } from "./carrier-config-api";
import { carrierKeys } from "./queries";

import type {
  PickupPointBody,
  PickupPointRecord,
  ServiceCodeBody,
  ServiceCodeRecord,
} from "./carrier-config-schemas";

export const useReplaceServiceCodes = createMutation<
  { carrierId: string; codes: ServiceCodeBody[] },
  ServiceCodeRecord[]
>(({ carrierId, codes }) => replaceServiceCodes(carrierId, codes), {
  // Danh mục hãng + danh sách cấu hình đọc lại bản đã lưu (bảng đang sửa giữ nguyên, xem `useRowsEditor`)
  invalidate: [carrierKeys.all],
  showErrorToast: false,
});

export const useReplacePickupPoints = createMutation<
  { carrierId: string; pickupPoints: PickupPointBody[] },
  PickupPointRecord[]
>(({ carrierId, pickupPoints }) => replacePickupPoints(carrierId, pickupPoints), {
  invalidate: [carrierKeys.all],
  showErrorToast: false,
});
