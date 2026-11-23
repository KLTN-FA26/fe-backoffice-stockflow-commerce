"use client";

import { useState } from "react";
import { FileDown, LoaderCircle } from "lucide-react";

import {
  BUSINESS_DOCUMENT_LABELS,
  BUSINESS_DOCUMENTS,
} from "@/constants/labels-business-documents";
import {
  businessDocumentErrorMessage,
  downloadBusinessDocument,
} from "@/lib/api/business-documents";
import { saveFile } from "@/lib/api/file-download";
import { useCan } from "@/lib/auth/components/Can";
import { Button } from "@/components/ui/button";

import type { BusinessDocumentKind } from "@/constants/labels-business-documents";

/**
 * Nút tải một giấy tờ nghiệp vụ (PDF do BE vẽ): chỉ hiện với vai có quyền của endpoint (UI-only — BE kiểm lại), lưu
 * file theo tên BE đặt trong `Content-Disposition`, lỗi 403 / 404 / mã riêng hiện câu tiếng Việt ngay dưới nút. Trong
 * lúc BE dựng PDF nút quay vòng và khoá (không bấm chồng).
 */
export function DocumentDownloadButton({
  kind,
  path,
  label,
  size = "sm",
  disabled = false,
}: {
  kind: BusinessDocumentKind;
  /** Đường GET (`BUSINESS_DOCUMENT_PATHS`); null = chưa đủ dữ kiện (vd chưa chọn kỳ) → khoá nút. */
  path: string | null;
  /** Nhãn khác nhãn mặc định của giấy tờ (vd dòng trong bảng). */
  label?: string;
  size?: "sm" | "xs";
  disabled?: boolean;
}) {
  const spec = BUSINESS_DOCUMENTS[kind];
  const allowed = useCan(spec.permission);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!allowed) return null;

  const download = async () => {
    if (!path) return;
    setBusy(true);
    setError(null);
    try {
      saveFile(await downloadBusinessDocument(kind, path));
    } catch (failure) {
      setError(businessDocumentErrorMessage(kind, failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        size={size}
        variant="outline"
        disabled={busy || disabled || !path}
        aria-busy={busy || undefined}
        onClick={() => void download()}
      >
        {busy ? (
          <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <FileDown className="size-3.5" aria-hidden="true" />
        )}
        {busy ? BUSINESS_DOCUMENT_LABELS.busy : (label ?? spec.label)}
      </Button>
      {error && (
        <span role="alert" className="text-danger max-w-[28rem] text-xs">
          {BUSINESS_DOCUMENT_LABELS.failedTitle(spec.noun)}: {error}
        </span>
      )}
    </span>
  );
}
