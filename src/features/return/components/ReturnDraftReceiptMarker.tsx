"use client";

import Link from "next/link";

import { RETURN_LABELS } from "@/constants/labels-return";
import { GOODS_RECEIPT_PERMISSIONS } from "@/constants/permissions";
import { RETURN_ROUTES } from "@/constants/returns";
import { useCan } from "@/lib/auth/components/Can";

import { useReturnReceipts } from "../queries";

const L = RETURN_LABELS.draftReceipt;

/**
 * Dòng hàng đợi có `receiptDraftOpen` (WF-05 BE-23, BE fc931ff9): kho đang đếm một kiện của yêu cầu trên phiếu nhập hàng
 * hoàn NHÁP. Dòng không mang id phiếu, nên chỉ dòng có cờ mới hỏi phiếu nháp của yêu cầu (`?returnRequestId=&status=DRAFT`,
 * 1 phiếu — BE chỉ cho một phiếu nháp mỗi lúc) để đưa tới đó. Không có quyền xem phiếu nhận hàng → chỉ hiện chữ.
 */
export function ReturnDraftReceiptMarker({ returnRequestId }: { returnRequestId: string }) {
  const canRead = useCan(GOODS_RECEIPT_PERMISSIONS.read);
  const drafts = useReturnReceipts(
    { page: 0, size: 1, statuses: ["DRAFT"], returnRequestId },
    { enabled: canRead },
  );
  const draftId = canRead ? drafts.data?.items[0]?.id : undefined;
  if (!draftId) return <span className="text-ink-secondary text-xs">{L.counting}</span>;
  return (
    <Link
      href={RETURN_ROUTES.receipts.detail(draftId)}
      className="text-accent-text text-xs font-medium hover:underline"
      aria-label={`${L.open} · ${L.counting}`}
      onClick={(event) => event.stopPropagation()}
    >
      {L.counting}
    </Link>
  );
}
