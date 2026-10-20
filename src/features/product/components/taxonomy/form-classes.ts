/**
 * Class ô nhập Mode A của form thương hiệu / danh mục — cùng thông số với form NCC
 * (`supplier-form/fields.tsx`) và PO: radius sm (4px), viền border.default, nền bg.surface, focus viền
 * brand.ink. Không sửa `components/ui/*` (shadcn mặc định `rounded-lg`), cũng không import chéo
 * feature nên khai báo ở đây.
 */
const BASE =
  "border-border-default bg-bg-surface text-ink-primary placeholder:text-ink-tertiary focus-visible:border-brand focus-visible:ring-brand/20 rounded-[var(--r-sm)] text-[0.8125rem] shadow-none aria-invalid:border-danger";

/** Input một dòng. */
export const TAXONOMY_INPUT_CLASS = `${BASE} h-9`;
/** Select trigger — full width như input. */
export const TAXONOMY_SELECT_CLASS = `${BASE} h-9 w-full data-[size=default]:h-9`;
/** Textarea nhiều dòng. */
export const TAXONOMY_TEXTAREA_CLASS = BASE;
