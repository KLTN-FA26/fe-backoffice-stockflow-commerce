/**
 * Hàng ở một vị trí — cảnh 3D (tem LPN thật trên thùng) và panel chi tiết của danh sách vị trí:
 *
 *   GET /inventory/stock-packages?location=                   (inventory-stock-packages:READ, BE StockPackageController)
 *   GET /inventory/stock-packages/location-summary?location=  (cùng quyền) — theo SKU, lô, trạng thái tồn
 *
 * `location` là ĐÚNG MỘT mã vị trí (không lọc theo tiền tố) nên mỗi vị trí một request — chỉ gọi cho kệ đang xem / vị trí
 * đang mở. Mặc định BE chỉ trả thùng còn sống (RECEIVING, IN_STOCK). Vị trí ở kho ngoài phạm vi → 403. Bản đồ vẫn chỉ
 * trực quan (BR-05).
 */

import { z } from "zod";

import { WAREHOUSE_MAP_LIMITS as LIMITS } from "@/constants";
import { STOCK_PACKAGE_API } from "@/constants/quarantine";
import { api } from "@/lib/api/client";
import { bePageSchema } from "@/lib/api/page-schema";

/** BE `StockPackageResponse` — các field màn vị trí hiện; còn lại để `loose`. */
export const locationCartonsDto = bePageSchema(
  z
    .object({
      lpn: z.string(),
      sku: z.string().nullish(),
      locationCode: z.string().nullish(),
      lotNumber: z.string().nullish(),
      nominalQty: z.number().int().nullish(),
      onHand: z.number().int().nullish(),
      reserved: z.number().int().nullish(),
      status: z.string().nullish(),
    })
    .loose(),
);

export type LocationCarton = z.infer<typeof locationCartonsDto>["items"][number];

/** Một trang thùng của vị trí, sắp theo LPN; `total` để báo khi vị trí nhiều thùng hơn một trang. */
export interface LocationCartonPage {
  items: LocationCarton[];
  total: number;
}

export async function listLocationCartonPage(
  locationCode: string,
  signal?: AbortSignal,
): Promise<LocationCartonPage> {
  const { data } = await api.get<unknown>(STOCK_PACKAGE_API.list, {
    params: { location: locationCode, page: 0, size: LIMITS.binCartonSize, sort: "lpn" },
    signal,
  });
  const page = locationCartonsDto.parse(data);
  return { items: page.items, total: page.totalElements };
}

export async function listLocationCartons(
  locationCode: string,
  signal?: AbortSignal,
): Promise<LocationCarton[]> {
  return (await listLocationCartonPage(locationCode, signal)).items;
}

/**
 * BE `StockPackageLocationLineResponse`: một dòng theo SKU, lô, trạng thái tồn — số thùng (thùng trong kho luôn
 * nguyên thùng), số cái trong các thùng đó, số cái lẻ (hàng trả lại, báo hỏng chưa đóng thùng) và tổng.
 */
export const locationSummaryDto = z.array(
  z.object({
    sku: z.string(),
    lotNumber: z.string().nullish(),
    status: z.string(),
    wholeCartons: z.number().int(),
    wholeCartonUnits: z.number().int(),
    looseUnits: z.number().int(),
    totalUnits: z.number().int(),
  }),
);

export type LocationSummaryLine = z.infer<typeof locationSummaryDto>[number];

/** 404 LOCATION_NOT_FOUND khi mã không còn; 403 khi vị trí ở kho ngoài phạm vi người xem. */
export async function getLocationSummary(
  locationCode: string,
  signal?: AbortSignal,
): Promise<LocationSummaryLine[]> {
  const { data } = await api.get<unknown>(STOCK_PACKAGE_API.locationSummary, {
    params: { location: locationCode },
    signal,
  });
  return locationSummaryDto.parse(data);
}
