"use client";

import { useState } from "react";

import { GOODS_RECEIPT_PERMISSIONS, RECEIPT_STATUS, UI_LABELS } from "@/constants";
import { useCan } from "@/lib/auth";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { useGoodsReceipt } from "@/features/receipt/queries";
import { isLegacyPurchaseReceipt } from "@/features/receipt/selectors";
import { Alert } from "@/components/shared/Alert";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { ReceiptCountSection } from "./count/ReceiptCountSection";
import { ReceiptActions } from "./detail/ReceiptActions";
import { ReceiptInfo, ReceiptOverviewCard } from "./detail/ReceiptInfo";
import { ReceiptLinesTable } from "./detail/ReceiptLinesTable";
import { Section } from "./primitives";
import { ReceiptLoadError } from "./ReceiptLoadError";
import { ReceiptPermissionGate } from "./ReceiptPermissionGate";

const LABEL = UI_LABELS.receipt;

function ReceiptDetailBody({ id }: { id: string }) {
  const canRead = useCan(GOODS_RECEIPT_PERMISSIONS.read);
  const query = useGoodsReceipt(id, { enabled: canRead });
  const [countDirty, setCountDirty] = useState(false);
  // Breadcrumb hiện số phiếu thay vì id (UUID của BE)
  useBreadcrumbLabel(id, query.data?.number);

  if (!canRead) return <ReceiptLoadError error={null} kind="no-read" />;
  if (query.isPending) return <PageSkeleton variant="detail" />;
  if (query.isError)
    return <ReceiptLoadError error={query.error} onRetry={() => void query.refetch()} />;
  const receipt = query.data;
  const draftLike =
    receipt.status === RECEIPT_STATUS.DRAFT || receipt.status === RECEIPT_STATUS.CANCELLED;

  return (
    // Giao diện kiểu Vercel như chi tiết sản phẩm (globals.css `.surface-soft`). Không hiện tiêu đề —
    // breadcrumb topbar đã có số phiếu và link về danh sách; h1 giữ cho screen reader.
    <div className="surface-soft surface-compact">
      <h1 className="sr-only">{receipt.number}</h1>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <ReceiptInfo receipt={receipt} />
          {isLegacyPurchaseReceipt(receipt) && (
            // BE 4A-8: mua hàng đã bỏ — phiếu cũ chỉ còn đọc (và huỷ khi còn nháp)
            <Alert tone="info" title={LABEL.legacyPurchase.title}>
              {LABEL.legacyPurchase.description}
            </Alert>
          )}
          <ReceiptCountSection receipt={receipt} onDirtyChange={setCountDirty} />
          <Section
            title={draftLike ? LABEL.linesDraftTitle : LABEL.linesConfirmedTitle}
            description={
              receipt.status === RECEIPT_STATUS.CANCELLED
                ? LABEL.linesCancelledDescription
                : draftLike
                  ? LABEL.linesDraftDescription
                  : LABEL.linesConfirmedDescription
            }
          >
            <ReceiptLinesTable receipt={receipt} draft={draftLike} />
          </Section>
        </div>
        <div className="space-y-5">
          <ReceiptActions receipt={receipt} countDirty={countDirty} />
          <ReceiptOverviewCard receipt={receipt} />
        </div>
      </div>
    </div>
  );
}

export function ReceiptDetail({ id }: { id: string }) {
  return (
    <ReceiptPermissionGate permissions={[GOODS_RECEIPT_PERMISSIONS.viewPage]}>
      <ReceiptDetailBody id={id} />
    </ReceiptPermissionGate>
  );
}
