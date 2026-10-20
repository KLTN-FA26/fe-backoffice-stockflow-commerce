import { Loader2 } from "lucide-react";

import { SUPPLIER_ITEM_UI_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";
import { CommandEmpty } from "@/components/ui/command";

const P = SUPPLIER_ITEM_UI_LABELS.skuPicker;

/**
 * Trạng thái danh sách gợi ý SKU khi chưa có dòng nào: đang tải, lỗi (Thử lại), không có kết quả.
 * `hasMore`: trang đầu toàn SKU đã có trong danh mục nhưng BE còn kết quả → nhắc gõ thêm, không
 * nói "không có SKU".
 */
export function InventorySkuOptionsStatus({
  isPending,
  isError,
  hasMore,
  onRetry,
}: {
  isPending: boolean;
  isError: boolean;
  hasMore: boolean;
  onRetry: () => void;
}) {
  if (isPending) {
    return (
      <p className="text-ink-tertiary flex items-center gap-2 px-3 py-4 text-xs" role="status">
        <Loader2 className="size-3.5 animate-spin" /> {P.loading}
      </p>
    );
  }
  if (isError) {
    return (
      <div className="flex items-center justify-between gap-2 px-3 py-3 text-xs" role="alert">
        <span className="text-danger">{P.loadFailed}</span>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          {P.retry}
        </Button>
      </div>
    );
  }
  return <CommandEmpty>{hasMore ? P.emptyButMore : P.empty}</CommandEmpty>;
}
