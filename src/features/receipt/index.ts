/**
 * Goods receipt — public API barrel.
 *
 * Import from here (not deep paths) to keep feature boundary clean.
 * `legacy/` = màn mock cũ, chỉ components cũ dùng; xoá khi B4/B6 thay màn danh sách + chi tiết.
 */

export * from "./types";
export * from "./schemas";
export * from "./carton-schemas";
export * from "./input-schemas";
export * from "./carton-input-schemas";
export * from "./qc-input-schemas";
export * from "./carton-selectors";
export * from "./api";
export * from "./count-api";
export * from "./qc-api";
export * from "./carton-api";
export * from "./carton-mutations";
export * from "./receivable-po-api";
export * from "./queries";
export * from "./mutations";
export * from "./selectors";
export * from "./count-selectors";
export * from "./lifecycle";
export * from "./errors";
// Hộp thoại in / in lại nhãn thùng LPN — trạm kiểm thùng (08 §6) dùng lại qua chỗ ghép `components/backoffice`.
export { PrintLabelsDialog, type PrintTarget } from "./components/cartons/PrintLabelsDialog";
