"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { discontinueWarningLabel } from "../lifecycle-labels";
import { OpenReferencesList } from "./OpenReferencesList";

import type { DiscontinueProductResult } from "../api";

/**
 * Kết quả sau khi ngừng kinh doanh: sản phẩm ĐÃ ngừng (cảnh báo không phải lỗi — BR-PRD-005, docs 01
 * bước 12) nhưng còn chứng từ mở tham chiếu SKU của nó; liệt kê để người dùng theo dõi.
 */
export function DiscontinueResultDialog({
  result,
  onClose,
}: {
  result: DiscontinueProductResult | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={result !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="border-border-default bg-bg-surface gap-0 rounded-[var(--r-xl)] border p-0 shadow-[var(--sh-lg)] ring-0 sm:max-w-[480px]"
      >
        <DialogHeader className="border-border-default border-b px-[18px] py-4">
          <DialogTitle className="text-ink-primary font-[family-name:var(--font-display)] text-[1.05rem] font-semibold">
            Đã ngừng kinh doanh sản phẩm
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 px-[18px] py-[18px]">
          <DialogDescription className="text-ink-secondary text-[0.875rem] leading-relaxed">
            {result?.product.name} đã ngừng kinh doanh. Lưu ý:
          </DialogDescription>
          <ul className="text-warning list-disc space-y-1 pl-5 text-[0.8125rem]">
            {result?.warnings.map((code) => (
              <li key={code}>{discontinueWarningLabel(code)}</li>
            ))}
          </ul>
          {result && result.openReferences.length > 0 && (
            <OpenReferencesList
              references={result.openReferences}
              truncated={result.openReferencesTruncated}
            />
          )}
        </div>
        <DialogFooter className="border-border-default bg-bg-subtle mx-0 mb-0 rounded-b-[var(--r-xl)] border-t px-[18px] py-[14px]">
          <Button type="button" size="sm" onClick={onClose} className="rounded-[var(--r-sm)]">
            Đã hiểu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
