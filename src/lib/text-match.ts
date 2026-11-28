/** Bỏ dấu tiếng Việt + chữ thường: gõ "ly giay" vẫn khớp "Ly giấy". */
export function foldText(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/gi, "d").toLowerCase();
}

/** `haystack` có chứa `needle` (bỏ dấu, không phân biệt hoa thường); `needle` rỗng = khớp. */
export function textIncludes(haystack: string | null | undefined, needle: string): boolean {
  const query = foldText(needle.trim());
  return !query || foldText(haystack ?? "").includes(query);
}
