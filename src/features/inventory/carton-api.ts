/**
 * Thùng hàng (LPN) — tra cứu mọi thùng (docs 20 §4.1), BE `StockPackageController` (develop #461, issue #454):
 *
 *   GET /inventory/stock-packages?warehouseId&sku&location&lotNumber&q&status*&stockStatus*&sort&page&size
 *   GET /inventory/stock-packages/{lpn}
 *
 * Quyền `inventory-stock-packages:READ`; chỉ thùng ở kho của người xem (BE `WarehouseScope`), lọc kho / vị trí ngoài
 * phạm vi → 403 OUT_OF_DATA_SCOPE. `status` / `stockStatus` lặp lại: Spring đọc `stockStatus=A&stockStatus=B`, không
 * phải `stockStatus[]=A` — nên `paramsSerializer: { indexes: null }`.
 */

import { QUARANTINE_API } from "@/constants/quarantine";

import { cartonDetailDto, cartonListInput, cartonPageDto } from "./carton-schemas";
import { inventoryRequest } from "./transport";

import type { CartonListParams } from "./carton-schemas";

export function listCartonLookup(params: CartonListParams, signal?: AbortSignal) {
  return inventoryRequest(
    {
      url: QUARANTINE_API.list,
      params: cartonListInput.parse(params),
      paramsSerializer: { indexes: null },
      signal,
    },
    cartonPageDto,
  );
}

export function getCartonLookup(lpn: string, signal?: AbortSignal) {
  return inventoryRequest({ url: QUARANTINE_API.carton(lpn), signal }, cartonDetailDto);
}
