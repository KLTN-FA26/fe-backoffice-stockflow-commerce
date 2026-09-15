/**
 * Brand assets.
 *
 * Logo là ảnh minh hoạ full-color (thùng hàng + đồ uống/đồ ăn + chữ "StockFlow"
 * bake sẵn trong ảnh) — public/logo.png, 1254×1254 (vuông). Dùng chung cho cả
 * wordmark đầy đủ lẫn mark thu gọn vì ảnh đã tự đủ nghĩa ở mọi kích thước.
 *
 * Palette trong ảnh KHÔNG khớp design token của Mode A/B — đây là ngoại lệ được
 * chấp nhận: palette thương hiệu sống độc lập với token UI, không kéo màu này
 * vào component. Xem .claude/rules/design-tokens.md — hex chỉ bị chặn trong
 * src/app|components|features, file ảnh trong public/ nằm ngoài phạm vi đó.
 */
export const BRAND = {
  /** Logo đầy đủ (đã có chữ "StockFlow" trong ảnh). */
  logoSrc: "/logo.png",
  /** Mark thu gọn — dùng chung ảnh full vì ảnh vuông, tự đủ nghĩa khi thu nhỏ. */
  iconSrc: "/logo.png",
  name: "StockFlowCommerce",
  wordmark: {
    primary: "Stock",
    accent: "Flow",
    suffix: "Commerce",
  },
  /** Alt text cho bản có chữ — wordmark đã chứa tên nên alt nêu đúng tên thương hiệu. */
  logoAlt: "StockFlowCommerce",
} as const;

/** Tỉ lệ khung gốc của logo.png — vuông (1254×1254) cho cả hai variant. */
export const BRAND_ASPECT = {
  full: 1,
  mark: 1,
} as const;
