/**
 * Tên loại xe cho người đọc — dùng chung kế hoạch xếp xe và chuyến xe (R3: tên trước, mã chỉ ở chú thích khi rê chuột).
 */

/** Có chữ ngoài ASCII (dấu tiếng Việt) — để phân biệt phần tiếng Anh với phần tiếng Việt của tên. */
const hasVietnamese = (text: string) => /[^\x00-\x7F]/.test(text);

/**
 * Tên tiếng Việt của loại xe. Danh mục seed ghi tên dạng "Box truck 1.25 t (xe tải 1,25 tấn)": CHỈ khi phần ngoài ngoặc
 * là tiếng Anh thuần ASCII và phần trong ngoặc là cụm viết thường có chữ tiếng Việt thì lấy phần trong ngoặc (viết hoa chữ đầu). Mọi dạng khác
 * giữ nguyên tên đầy đủ — "Xe tải 1,25 tấn (thùng bạt)", "Xe cẩu (crane)", "Container (20ft)" là tên thật, không phải bản
 * dịch. Riêng ngoặc chỉ lặp lại mã ("Container 20' Dry (20DC)") thì bỏ phần ngoặc.
 */
export function vehicleTypeName(type: { code: string; name: string }): string {
  const full = type.name.trim();
  const match = /^(.*?)\s*\(([^()]+)\)\s*$/.exec(full);
  if (!match) return full;
  const [, outer = "", inner = ""] = match;
  if (inner.trim().toLowerCase() === type.code.trim().toLowerCase()) return outer || full;
  const startsLower = inner.charAt(0) === inner.charAt(0).toLowerCase();
  if (hasVietnamese(outer) || !hasVietnamese(inner) || !startsLower) return full;
  return inner.charAt(0).toLocaleUpperCase("vi") + inner.slice(1);
}
