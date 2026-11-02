import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CommandEmpty } from "@/components/ui/command";

import type { InventoryItemPickerLabels } from "@/constants";

/**
 * Trạng thái danh sách gợi ý SKU khi chưa có dòng nào: đang tải, lỗi (Thử lại), không có kết quả.
 * `hasMore`: trang đầu toàn SKU bị loại nhưng BE còn kết quả → nhắc gõ thêm, không nói "không có SKU".
 */
export function InventoryItemOptionsStatus({
  isPending,
  isError,
  hasMore,
  onRetry,
  labels,
}: {
  isPending: boolean;
  isError: boolean;
  hasMore: boolean;
  onRetry: () => void;
  labels: InventoryItemPickerLabels;
}) {
  if (isPending) {
    return (
      <p className="text-ink-tertiary flex items-center gap-2 px-3 py-4 text-xs" role="status">
        <Loader2 className="size-3.5 animate-spin" /> {labels.loading}
      </p>
    );
  }
  if (isError) {
    return (
      <div className="flex items-center justify-between gap-2 px-3 py-3 text-xs" role="alert">
        <span className="text-danger">{labels.loadFailed}</span>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          {labels.retry}
        </Button>
      </div>
    );
  }
  return <CommandEmpty>{hasMore ? labels.emptyButMore : labels.empty}</CommandEmpty>;
}
