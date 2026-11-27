import { parseAsString } from "nuqs";

/**
 * Khoá URL của bảng giá một khách (state-persistence — F5 / gửi link giữ nguyên): ô tìm SKU chính + lọc trên header từng
 * cột. Đổi / bỏ chọn khách thì `useSelectedCustomer` xoá hết (bảng mới, không mang lọc của khách trước).
 */
export const PRICE_TABLE_PARSERS = {
  cpQ: parseAsString.withDefault(""),
  cpSku: parseAsString.withDefault(""),
  cpMoqFrom: parseAsString.withDefault(""),
  cpMoqTo: parseAsString.withDefault(""),
  cpTiersFrom: parseAsString.withDefault(""),
  cpTiersTo: parseAsString.withDefault(""),
  cpLowFrom: parseAsString.withDefault(""),
  cpLowTo: parseAsString.withDefault(""),
  cpHighFrom: parseAsString.withDefault(""),
  cpHighTo: parseAsString.withDefault(""),
};
export type PriceTableParam = keyof typeof PRICE_TABLE_PARSERS;

/** Mọi khoá về `null` — gộp vào lần đổi khách. */
export const CLEARED_PRICE_TABLE_PARAMS = Object.fromEntries(
  Object.keys(PRICE_TABLE_PARSERS).map((key) => [key, null]),
) as Record<PriceTableParam, null>;
