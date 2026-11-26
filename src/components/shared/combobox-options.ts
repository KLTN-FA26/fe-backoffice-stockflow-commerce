import { COMBOBOX_MAX_ROWS } from "@/constants";

/** Chữ thường, bỏ dấu tiếng Việt — gõ "thu dau mot" vẫn khớp "Thủ Dầu Một". */
function fold(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replaceAll("đ", "d");
}

/** Hạng khớp — số nhỏ = khớp tốt hơn; `null` = không khớp. */
const RANK = { exact: 0, prefix: 1, contains: 2, initials: 3, fuzzy: 4 } as const;

/** Chữ cái đầu mỗi từ: "thanh pho ho chi minh" → "tphcm" (gõ tắt "hcm" vẫn ra). */
function initialsOf(text: string): string {
  return text
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("");
}

function isSubsequence(term: string, text: string): boolean {
  let at = 0;
  for (const char of text) if (char === term[at] && ++at === term.length) return true;
  return false;
}

function rankText(term: string, text: string): number | null {
  if (text === term) return RANK.exact;
  if (text.startsWith(term)) return RANK.prefix;
  if (text.includes(term)) return RANK.contains;
  if (initialsOf(text).includes(term)) return RANK.initials;
  if (isSubsequence(term, text)) return RANK.fuzzy;
  return null;
}

/**
 * Lọc + xếp hạng + cắt danh sách đã tải sẵn ở client cho `InputCombobox` (caller đặt `shouldFilter={false}` và giữ
 * `search`): chỉ hiện `COMBOBOX_MAX_ROWS` mục khớp tốt nhất, `hidden` = số mục khớp còn lại để báo "Còn N kết quả — gõ
 * thêm" (`ComboboxMoreHint`). Không phân biệt hoa thường / dấu. Xếp theo hạng: trùng hệt → bắt đầu bằng → chứa → chữ
 * cái đầu các từ ("hcm") → khớp rải rác (như lọc mờ của cmdk trước đây); cùng hạng giữ thứ tự gốc. Nhờ vậy quét / gõ
 * đủ một mã rồi Enter luôn chọn đúng mã đó, không chọn mã dài hơn chứa nó ("A-01-1" không ra "A-01-10" trước).
 * `textOf` trả một chuỗi hoặc nhiều chuỗi (tên + tên không dấu…): lấy hạng tốt nhất. Ô tìm trống = mọi mục theo thứ tự gốc.
 */
export function limitComboboxOptions<T>(
  items: readonly T[],
  search: string,
  textOf: (item: T) => string | readonly string[],
  max: number = COMBOBOX_MAX_ROWS,
): { visible: T[]; hidden: number } {
  const term = fold(search.trim());
  if (!term) return { visible: items.slice(0, max), hidden: Math.max(0, items.length - max) };
  const ranked: { item: T; rank: number; order: number }[] = [];
  items.forEach((item, order) => {
    const texts = [textOf(item)].flat().map((text) => fold(text));
    const ranks = texts.map((text) => rankText(term, text)).filter((rank) => rank !== null);
    if (ranks.length > 0) ranked.push({ item, rank: Math.min(...ranks), order });
  });
  ranked.sort((a, b) => a.rank - b.rank || a.order - b.order);
  return {
    visible: ranked.slice(0, max).map(({ item }) => item),
    hidden: Math.max(0, ranked.length - max),
  };
}
