import { UI_LABELS } from "@/constants";
import { ToneDot } from "@/components/shared/column-helpers";

/**
 * Cờ `active` của thuộc tính / thương hiệu / danh mục (BE `boolean active`, bật lại được — không
 * phải trạng thái kết thúc như `OBSOLETE` của biến thể). Đang dùng = chấm xanh, ngừng dùng = chấm
 * xám (`status.muted`), cùng dáng StatusDot.
 */
export function ActiveDot({ active }: { active: boolean }) {
  return active ? (
    <ToneDot tone="positive" label={UI_LABELS.taxonomy.active} />
  ) : (
    <ToneDot tone="muted" label={UI_LABELS.taxonomy.inactive} />
  );
}
