/**
 * Class ô nhập Mode A dùng chung cho form back-office: radius sm (4px), viền border.default, nền
 * bg.surface, focus viền brand.ink, `aria-invalid` viền danger. Bọc ngoài shadcn qua `className`
 * thay vì sửa `components/ui/*` (mặc định `rounded-lg`). Không chứa nghiệp vụ.
 */
const BASE =
  "border-border-default bg-bg-surface text-ink-primary placeholder:text-ink-tertiary focus-visible:border-brand focus-visible:ring-brand/20 rounded-[var(--r-sm)] text-[0.8125rem] shadow-none aria-invalid:border-danger";

/** Input một dòng. */
export const FORM_INPUT_CLASS = `${BASE} h-9`;
/** Select trigger — full width như input. */
export const FORM_SELECT_CLASS = `${BASE} h-9 w-full data-[size=default]:h-9`;
/** Textarea nhiều dòng. */
export const FORM_TEXTAREA_CLASS = BASE;
