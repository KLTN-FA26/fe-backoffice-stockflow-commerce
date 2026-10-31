/**
 * Đơn vị hành chính Việt Nam 2 cấp (tỉnh / thành phố → phường / xã, sau sắp xếp 07/2025 — 34 tỉnh /
 * thành) từ API công khai provinces.open-api.vn v2. Dùng cho ô chọn địa chỉ (kho, sau này địa chỉ khách).
 */
export const VN_DIVISIONS_API = {
  base: "https://provinces.open-api.vn/api/v2",
  /** Danh sách tỉnh / thành phố (không kèm phường / xã). */
  provinces: "/p/",
  /** Một tỉnh kèm toàn bộ phường / xã (`depth=2`). */
  province: (code: number) => `/p/${code}?depth=2`,
} as const;

/** Danh mục hành chính hiếm đổi → giữ cache cả phiên làm việc, không tải lại khi đổi tab. */
export const VN_DIVISIONS_STALE_MS = 24 * 60 * 60 * 1000;
