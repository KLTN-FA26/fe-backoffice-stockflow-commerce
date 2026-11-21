/**
 * Thùng có LPN đang nằm ở một vị trí — để cảnh 3D dán tem LPN thật lên thùng khi xem một kệ.
 *
 *   GET /inventory/stock-packages?location=   (inventory-stock-packages:READ, BE StockPackageController)
 *
 * `location` là ĐÚNG MỘT mã vị trí (không lọc theo tiền tố) nên mỗi bin có hàng một request — chỉ gọi cho kệ đang
 * xem. Mặc định BE chỉ trả thùng còn sống (RECEIVING, IN_STOCK). Bản đồ vẫn chỉ trực quan (BR-05).
 */

import { z } from "zod";

import { WAREHOUSE_MAP_LIMITS as LIMITS } from "@/constants";
import { STOCK_PACKAGE_API } from "@/constants/quarantine";
import { api } from "@/lib/api/client";
import { bePageSchema } from "@/lib/api/page-schema";

/** BE `StockPackageResponse` — bản đồ chỉ cần LPN, SKU, mã vị trí. */
export const locationCartonsDto = bePageSchema(
  z
    .object({
      lpn: z.string(),
      sku: z.string().nullish(),
      locationCode: z.string().nullish(),
    })
    .loose(),
);

export type LocationCarton = z.infer<typeof locationCartonsDto>["items"][number];

export async function listLocationCartons(
  locationCode: string,
  signal?: AbortSignal,
): Promise<LocationCarton[]> {
  const { data } = await api.get<unknown>(STOCK_PACKAGE_API.list, {
    params: { location: locationCode, page: 0, size: LIMITS.binCartonSize, sort: "lpn" },
    signal,
  });
  return locationCartonsDto.parse(data).items;
}
