/**
 * Goods receipt — public API barrel.
 *
 * Import from here (not deep paths) to keep feature boundary clean.
 * `legacy/` = màn mock cũ, chỉ components cũ dùng; xoá khi B4/B6 thay màn danh sách + chi tiết.
 */

export * from "./types";
export * from "./schemas";
export * from "./input-schemas";
export * from "./api";
export * from "./receivable-po-api";
export * from "./queries";
export * from "./mutations";
export * from "./selectors";
export * from "./lifecycle";
export * from "./errors";
