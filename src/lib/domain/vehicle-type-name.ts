/**
 * Tên loại xe cho người đọc — dùng chung kế hoạch xếp xe và chuyến xe (R3: tên trước, mã chỉ ở chú thích khi rê chuột).
 */

/**
 * Tên tiếng Việt của loại xe. Danh mục ghi tên dạng "Box truck 1.25 t (xe tải 1,25 tấn)": lấy phần trong ngoặc khi nó là
 * một cụm từ tiếng Việt viết thường (không phải mã); tên chỉ có mã trong ngoặc ("Container 20' Dry (20DC)") thì bỏ phần
 * ngoặc. Tên không theo dạng đó giữ nguyên.
 */
export function vehicleTypeName(type: { code: string; name: string }): string {
  const match = /^(.*?)\s*\(([^()]+)\)\s*$/.exec(type.name.trim());
  if (!match) return type.name.trim();
  const [, outer = "", inner = ""] = match;
  const isCode = inner.trim().toLowerCase() === type.code.trim().toLowerCase();
  if (isCode) return outer || type.name.trim();
  const startsLower = inner.charAt(0) === inner.charAt(0).toLowerCase() && /\p{L}/u.test(inner);
  if (!startsLower) return type.name.trim();
  return inner.charAt(0).toLocaleUpperCase("vi") + inner.slice(1);
}
