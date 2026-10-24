/**
 * Lỗi BE của ước tính xếp xe (BE PR #160) → câu tiếng Việt. Rẽ nhánh theo `errorCode` ổn định (không theo message
 * tiếng Anh); `VALIDATION_FAILED` rẽ tiếp theo `fieldErrors[].code` của ô `warehouseId` / `vehicleTypeIds`.
 */

import { LOAD_ESTIMATE_ERROR_MESSAGES as MESSAGES } from "@/constants";
import { ApiError } from "@/lib/api/error";

type CodedMessage = Exclude<keyof typeof MESSAGES, "generic">;

const isCodedMessage = (code: string): code is CodedMessage =>
  code !== "generic" && Object.hasOwn(MESSAGES, code);

/** `VALIDATION_FAILED`: BE nêu ô lỗi bằng `fieldErrors[].code` (xem `LoadEstimateService`). */
function validationMessage(error: ApiError): string {
  const fieldCodes = error.fieldCodes ?? {};
  switch (fieldCodes.warehouseId) {
    case "NotNull":
      return MESSAGES.WAREHOUSE_REQUIRED;
    case "WarehouseMismatch":
      return MESSAGES.WAREHOUSE_MISMATCH;
    case "WarehouseInactive":
      return MESSAGES.WAREHOUSE_INACTIVE;
  }
  if (error.fieldErrors && "vehicleTypeIds" in error.fieldErrors)
    return MESSAGES.NO_ACTIVE_VEHICLE_TYPE;
  return MESSAGES.VALIDATION_FAILED;
}

export function estimateErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return MESSAGES.generic;
  if (error.code === "VALIDATION_FAILED") return validationMessage(error);
  if (isCodedMessage(error.code)) return MESSAGES[error.code];
  if (error.status === 403) return MESSAGES.FORBIDDEN;
  return MESSAGES.generic;
}

const PACKAGING_FIELD = /^inventoryItems\[(.+)\]$/;

/**
 * 422 LOAD_ESTIMATE_PACKAGING_MISSING (không dòng nào đủ kích thước / khối lượng): BE nêu mỗi mặt hàng thiếu bằng một
 * lỗi trường `inventoryItems[<inventoryItemId>]` — trả các id đó để màn dẫn sang hồ sơ hàng tồn. Lỗi khác → rỗng.
 */
export function packagingMissingItemIds(error: unknown): string[] {
  if (!(error instanceof ApiError) || error.code !== "LOAD_ESTIMATE_PACKAGING_MISSING") return [];
  return Object.keys(error.fieldErrors ?? {}).flatMap(
    (field) => PACKAGING_FIELD.exec(field)?.[1] ?? [],
  );
}
