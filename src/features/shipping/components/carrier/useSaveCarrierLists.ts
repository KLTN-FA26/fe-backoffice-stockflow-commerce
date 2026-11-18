import { UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import {
  useReplacePickupPoints,
  useReplaceServiceCodes,
} from "@/features/shipping/carrier-config-mutations";
import { pickupPointBodies, pickupPointRowsFrom } from "@/features/shipping/carrier-pickup-rows";
import {
  serviceCodeBodies,
  serviceCodeRowsFrom,
} from "@/features/shipping/carrier-service-code-rows";
import { shippingErrorMessage } from "@/features/shipping/errors";

import type { Carrier } from "@/features/shipping/types";
import type { CarrierTables } from "./useCarrierTables";

const CFG = UI_LABELS.shipping.waybill.carriers.config;

/** Lỗi ghi danh sách: kho ngoài phạm vi / không có là chuyện của điểm lấy hàng, không phải "chuyến / lô giao". */
function listErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === "OUT_OF_DATA_SCOPE")
    return CFG.saveProgress.outOfScope;
  if (error instanceof ApiError && error.code === "NOT_FOUND")
    return CFG.saveProgress.warehouseNotFound;
  return shippingErrorMessage(error);
}

/**
 * Ghi các danh sách đã sửa (mã dịch vụ, điểm lấy hàng) SAU khi hãng lưu xong: hai PUT riêng, chỉ nhận hãng đã ở kiểu API đặt
 * xe, và chỉ danh sách đã sửa mới được gửi. Trả về phần đã lưu và phần lỗi (kèm lý do tiếng Việt) để hộp thoại nói rõ.
 */
export function useSaveCarrierLists(tables: CarrierTables) {
  const replaceCodes = useReplaceServiceCodes();
  const replacePoints = useReplacePickupPoints();
  /** Ghi các danh sách đã sửa sau khi hãng lưu xong; trả về phần đã lưu và phần lỗi (kèm lý do tiếng Việt). */
  return async (carrier: Carrier) => {
    const done: string[] = [];
    const failed: string[] = [];
    if (carrier.connection?.connectionType !== "API_BOOKING") return { done, failed };
    const run = async (label: string, write: () => Promise<void>) => {
      try {
        await write();
        done.push(label);
      } catch (error) {
        failed.push(`${label} (${listErrorMessage(error)})`);
      }
    };
    if (tables.serviceCodes.dirty) {
      await run(CFG.saveProgress.serviceCodesPart, async () => {
        const codes = await replaceCodes.mutateAsync({
          carrierId: carrier.carrierId,
          codes: serviceCodeBodies(tables.serviceCodes.rows),
        });
        tables.serviceCodes.markSaved(serviceCodeRowsFrom(codes));
      });
    }
    if (tables.pickupPoints.dirty) {
      await run(CFG.saveProgress.pickupPointsPart, async () => {
        const points = await replacePoints.mutateAsync({
          carrierId: carrier.carrierId,
          pickupPoints: pickupPointBodies(tables.pickupPoints.rows),
        });
        tables.pickupPoints.markSaved(pickupPointRowsFrom(points));
      });
    }
    return { done, failed };
  };
}
