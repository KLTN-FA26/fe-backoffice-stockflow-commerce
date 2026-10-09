import Link from "next/link";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";
import { Alert } from "@/components/shared/Alert";

import type { GoodsReceiptRow } from "@/features/receipt/types";

/**
 * PO đã có phiếu nháp: BE cho tạo thêm, nhưng tính cả phiếu nháp vào dung sai (BR-02,
 * `checkTolerance`) → cảnh báo để người dùng kiểm đếm tiếp trên phiếu cũ, tránh đếm trùng.
 */
export function ExistingDraftsAlert({ drafts }: { drafts: readonly GoodsReceiptRow[] }) {
  if (drafts.length === 0) return null;
  return (
    <Alert tone="warning" className="mt-3">
      {UI_LABELS.receipt.draftExists}{" "}
      {drafts.map((draft, index) => (
        <span key={draft.id}>
          {index > 0 && ", "}
          <Link
            href={ADMIN_ROUTES.receipts.detail(draft.id)}
            className="text-accent font-[family-name:var(--font-mono)] font-medium hover:underline"
          >
            {draft.number}
          </Link>
        </span>
      ))}
    </Alert>
  );
}
