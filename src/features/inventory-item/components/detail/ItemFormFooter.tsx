import { UI_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";

const L = UI_LABELS.inventoryItem;

/** Alert lỗi của khối + báo item vừa đổi + nút Huỷ / Lưu dùng chung cho hai form. */
export function ItemFormFooter({
  error,
  outdated,
  submitLabel,
  canSubmit,
  isPending,
  onCancel,
}: {
  error: string | null;
  /** Có version mới hơn dữ liệu form đang sửa — báo, không chặn. */
  outdated: boolean;
  submitLabel: string;
  canSubmit: boolean;
  isPending: boolean;
  onCancel: () => void;
}) {
  return (
    <>
      {outdated && (
        <p role="status" className="text-warning text-xs">
          {L.outdatedNotice}
        </p>
      )}
      {error && (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          {L.cancel}
        </Button>
        <Button type="submit" size="sm" disabled={!canSubmit || isPending}>
          {isPending ? L.saving : submitLabel}
        </Button>
      </div>
    </>
  );
}
