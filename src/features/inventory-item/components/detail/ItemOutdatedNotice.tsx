import { UI_LABELS } from "@/constants";

/** Có version mới hơn dữ liệu form đang sửa — báo, không chặn (dùng chung cho hai popup sửa). */
export function ItemOutdatedNotice({ outdated }: { outdated: boolean }) {
  if (!outdated) return null;
  return (
    <p role="status" className="text-warning text-xs">
      {UI_LABELS.inventoryItem.outdatedNotice}
    </p>
  );
}
