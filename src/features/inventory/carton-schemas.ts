import { z } from "zod";

import { CARTON_FILTER_STATUSES, CARTON_SEARCH_MIN, CARTON_SORTS } from "@/constants";
import { STOCK_STATUSES } from "@/constants/inventory";

import { beUuid } from "@/lib/validation/primitives";

import { stockPackageDetailDto, stockPackageDto } from "./quarantine-schemas";
import { inventoryPageDto } from "./schemas";

const SORT_DIRECTIONS = ["asc", "desc"] as const;

/** BE `Pages.MAX_PAGE_SIZE` — cỡ trang lớn hơn bị 400. */
const MAX_PAGE_SIZE = 200;

// Source: backend develop #461 (issue #454) — các field đọc được thêm vào `StockPackageResponse` và
// `StockPackageDetailResponse`. Mọi field `nullish` / mảng mặc định rỗng: BE cũ chưa có thì màn vẫn chạy (cột để "—").
// `source`, `openTask.type`, `stockStatuses` là chuỗi mở — giá trị lạ hiện nguyên văn, không làm vỡ danh sách.
const cartonReadableFields = {
  warehouseId: beUuid.nullish(),
  warehouseCode: z.string().nullish(),
  productName: z.string().nullish(),
  variantName: z.string().nullish(),
  stockStatuses: z
    .array(z.string())
    .nullish()
    .transform((value) => value ?? []),
  receivedAt: z.iso.datetime().nullish(),
  goodsReceiptId: beUuid.nullish(),
  goodsReceiptNumber: z.string().nullish(),
  source: z.string().nullish(),
  heldFor: z
    .array(
      z.object({
        orderId: beUuid,
        orderNumber: z.string().nullish(),
        quantity: z.number().int().nonnegative(),
      }),
    )
    .nullish()
    .transform((value) => value ?? []),
  // id chỉ dùng dựng link sang màn xử lý — không ép UUID để một id lạ không làm hỏng cả trang danh sách
  openTask: z
    .object({ type: z.string(), id: z.string().min(1), number: z.string().nullish() })
    .nullish()
    .transform((value) => value ?? null),
};

export const cartonRowDto = stockPackageDto.extend(cartonReadableFields);
export const cartonPageDto = inventoryPageDto(cartonRowDto);
export const cartonDetailDto = stockPackageDetailDto.extend(cartonReadableFields);

const code = z
  .string()
  .trim()
  .toUpperCase()
  .optional()
  .transform((value) => value || undefined);

/**
 * Tham số `GET /inventory/stock-packages` của màn Thùng hàng. `sku` / `location` / `lotNumber` khớp ĐÚNG mã (viết hoa
 * như BE lưu); `q` là một phần LPN, dưới 3 ký tự thì không gửi (BE 400). `status` / `stockStatus` lặp lại — gửi
 * `stockStatus=A&stockStatus=B`, xem `paramsSerializer` ở `carton-api.ts`.
 */
export const cartonListInput = z
  .object({
    page: z.number().int().nonnegative(),
    size: z.number().int().positive().max(MAX_PAGE_SIZE),
    q: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value && value.length >= CARTON_SEARCH_MIN ? value : undefined)),
    warehouseId: z.string().optional(),
    sku: code,
    location: code,
    lotNumber: code,
    status: z.array(z.enum(CARTON_FILTER_STATUSES)).optional(),
    stockStatus: z.array(z.enum(STOCK_STATUSES)).optional(),
    sort: z.enum(CARTON_SORTS).optional(),
    direction: z.enum(SORT_DIRECTIONS).optional(),
  })
  // Spring `field,dir`; mặc định tăng dần (FIFO = `receivedAt,asc`, cũ nhất trước)
  .transform(({ sort, direction, ...rest }) => ({
    ...rest,
    sort: sort ? `${sort},${direction ?? "asc"}` : undefined,
  }));

export type CartonListParams = z.input<typeof cartonListInput>;
