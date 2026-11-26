/**
 * Bậc giá theo thùng — câu chữ chung của bảng giá riêng của khách (kltn-docs 13 BR-05) và giá chuẩn theo quy cách (13
 * BR-04 sửa ngày 2026-11-26). Hai bảng giá cùng luật BE (`PriceTiers`, `SellingPrice`): 1–20 bậc, mỗi bậc từ N thùng
 * (≥ 1, không trùng) một đơn giá VND nguyên > 0 cho một cái; MOQ là bậc nhỏ nhất.
 */

import { PRICE_TIER_LIMITS as L } from "./numbers";

/** Lỗi theo ô của form bậc giá (zod), chép luật BE. */
export const PRICE_TIER_FIELD_MESSAGES = {
  tiersCount: `Cần từ 1 đến ${L.tiersMax} bậc giá`,
  minQuantity: `Số thùng từ là số nguyên từ ${L.minQuantityMin} trở lên`,
  // BE `PriceTiers`: "Two price tiers start at N"
  minQuantityDuplicate: "Hai bậc giá không được bắt đầu cùng một số thùng",
  // BE `SellingPrice`: > 0, VND số nguyên, tối đa 16 chữ số phần nguyên
  unitPrice: `Đơn giá là số tiền VND nguyên lớn hơn 0, tối đa ${L.priceIntegerDigitsMax} chữ số`,
  // Giá JSON đi qua số thực IEEE-754 của trình duyệt — quá nhiều chữ số thì không gửi nguyên vẹn được
  unitPricePrecision: "Đơn giá có quá nhiều chữ số để gửi chính xác — hãy bớt chữ số",
  note: `Ghi chú tối đa ${L.noteMax} ký tự`,
  version: "Thiếu phiên bản dữ liệu — tải lại bảng giá rồi lưu lại",
} as const;

/** Nhãn của ô nhập bậc giá (`PriceTierEditor`) và luật riêng của form (chỉ chữ số, giá cũ không chính xác). */
export const PRICE_TIER_FORM_LABELS = {
  tiers: "Bậc giá",
  minQuantity: "Từ số thùng",
  unitPrice: "Đơn giá / cái (VND)",
  moqHint: "MOQ được xác định bởi số thùng nhỏ nhất.",
  tierOrderHint: "Có thể nhập các bậc theo thứ tự bất kỳ — hệ thống tự sắp theo số thùng.",
  addTier: "Thêm bậc giá",
  removeTier: (index: number) => `Xoá bậc giá ${index}`,
  tierLabel: (index: number) => `Bậc ${index}`,
  tierLimit: `Tối đa ${L.tiersMax} bậc giá.`,
  skuInvalid: "Mã SKU không đúng định dạng (chữ, số, dấu . _ -; tối đa 64 ký tự)",
  // Đơn giá VND nguyên: "95.000" của người dùng VN là 95 nghìn — chỉ nhận chữ số để không lưu nhầm 95 đ
  digitsOnly: "Đơn giá chỉ gồm chữ số, không dùng dấu chấm / phẩy (vd 95000)",
  inexactReplace: "Giá cũ không đọc chính xác được — nhập lại đơn giá cho bậc này",
} as const;
