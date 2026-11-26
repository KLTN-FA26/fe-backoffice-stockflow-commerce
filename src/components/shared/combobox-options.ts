import { COMBOBOX_MAX_ROWS } from "@/constants";

/** Chữ thường, bỏ dấu tiếng Việt — gõ "thu dau mot" vẫn khớp "Thủ Dầu Một". */
function fold(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replaceAll("đ", "d");
}

/**
 * Lọc + cắt danh sách đã tải sẵn ở client cho `InputCombobox` (caller đặt `shouldFilter={false}` và giữ `search`):
 * chỉ hiện `COMBOBOX_MAX_ROWS` dòng đầu của các mục khớp, `hidden` = số mục khớp còn lại để báo "Còn N kết quả — gõ
 * thêm" (`ComboboxMoreHint`). Khớp là "chứa" không phân biệt hoa thường / dấu; ô tìm trống = mọi mục.
 */
export function limitComboboxOptions<T>(
  items: readonly T[],
  search: string,
  textOf: (item: T) => string,
  max: number = COMBOBOX_MAX_ROWS,
): { visible: T[]; hidden: number } {
  const term = fold(search.trim());
  const matched = term ? items.filter((item) => fold(textOf(item)).includes(term)) : items;
  return { visible: matched.slice(0, max), hidden: Math.max(0, matched.length - max) };
}
