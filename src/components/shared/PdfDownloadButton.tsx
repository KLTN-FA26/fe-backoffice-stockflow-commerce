"use client";

import { Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Nút "Tải PDF" của một file do BE sinh: đang tạo thì khoá nút + vòng quay (chặn bấm đúp). Vô nghiệp vụ — nhận nhãn và
 * thao tác qua props; mỗi feature tự nối mutation của mình.
 */
export function PdfDownloadButton({
  label,
  pendingLabel,
  pending,
  onDownload,
}: {
  label: string;
  pendingLabel: string;
  pending: boolean;
  onDownload: () => void;
}) {
  return (
    <Button type="button" size="sm" variant="outline" disabled={pending} onClick={onDownload}>
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <Download className="size-3.5" aria-hidden="true" />
      )}
      {pending ? pendingLabel : label}
    </Button>
  );
}
