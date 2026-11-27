import DOMPurify from "isomorphic-dompurify";

import { UI_LABELS } from "@/constants";

/**
 * Thẻ và thuộc tính được giữ — đúng danh sách BE lọc (`RichTextPolicy`, ADR-0013): những gì Tiptap StarterKit + Image
 * viết ra. BE đã lọc trước khi lưu; lọc lại ở đây vì HTML đi thẳng vào `dangerouslySetInnerHTML` (lớp bảo vệ thứ hai).
 */
const ALLOWED_TAGS = [
  "p",
  "br",
  "h1",
  "h2",
  "h3",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "code",
  "pre",
  "blockquote",
  "ul",
  "ol",
  "li",
  "hr",
  "a",
  "img",
];
const ALLOWED_ATTR = ["href", "title", "rel", "src", "alt"];

/** HTML mô tả đã lọc; chỉ còn khoảng trắng / thẻ rỗng thì trả chuỗi rỗng. */
export function sanitizeRichText(html: string | null | undefined): string {
  if (!html?.trim()) return "";
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i,
  });
  const hasContent = /<img\b|<hr\b/i.test(clean) || clean.replace(/<[^>]*>/g, "").trim() !== "";
  return hasContent ? clean : "";
}

/**
 * Hiển thị một mô tả rich text (HTML của Tiptap) — mô tả sản phẩm / biến thể. Không chứa nghiệp vụ: nhận HTML qua prop,
 * rỗng thì hiện `empty`.
 */
export function RichTextView({
  html,
  empty = UI_LABELS.richText.empty,
  className = "",
}: {
  html: string | null | undefined;
  empty?: string;
  className?: string;
}) {
  const clean = sanitizeRichText(html);
  if (!clean) return <p className="text-ink-tertiary text-[0.8125rem]">{empty}</p>;
  return (
    <div
      className={`rich-text max-w-[75ch] ${className}`}
      // HTML đã qua sanitizeRichText (allow-list ở trên) — không có script / thuộc tính sự kiện.
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
