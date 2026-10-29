"use client";

import { useCallback, useState } from "react";

import { GOODS_RECEIPT_PERMISSIONS, RECEIPT_STATUS, UI_LABELS } from "@/constants";
import { useCan, usePermissionChecker } from "@/lib/auth";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { allowedReceiptActions } from "@/features/receipt/lifecycle";
import { useGoodsReceipt } from "@/features/receipt/queries";
import { Alert } from "@/components/shared/Alert";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { InspectDialog } from "./detail/InspectDialog";
import { MoveToQcDialog } from "./detail/MoveToQcDialog";
import { ReceiptActions } from "./detail/ReceiptActions";
import { BlindCountPanel } from "./detail/BlindCountPanel";
import { DraftCountPanel } from "./detail/DraftCountPanel";
import { ReceiptInfo, ReceiptOverviewCard } from "./detail/ReceiptInfo";
import { ReceiptLinesTable } from "./detail/ReceiptLinesTable";
import { ReferencedPoCard } from "./detail/ReferencedPoCard";
import { Section } from "./primitives";
import { ReceiptLoadError } from "./ReceiptLoadError";
import { ReceiptPermissionGate } from "./ReceiptPermissionGate";

import type { ReceiptLineActionCode } from "@/features/receipt/lifecycle";
import type { ReceiptLineDto } from "@/features/receipt/types";

function ReceiptDetailBody({ id }: { id: string }) {
  const canRead = useCan(GOODS_RECEIPT_PERMISSIONS.read);
  const can = usePermissionChecker();
  const query = useGoodsReceipt(id, { enabled: canRead });
  const [dirty, setDirty] = useState(false);
  const [lineDialog, setLineDialog] = useState<{
    code: ReceiptLineActionCode;
    line: ReceiptLineDto;
  } | null>(null);
  const onDirtyChange = useCallback((d: boolean) => setDirty(d), []);
  // Breadcrumb hiện số phiếu thay vì id (UUID của BE)
  useBreadcrumbLabel(id, query.data?.number);

  if (!canRead) return <ReceiptLoadError error={null} kind="no-read" />;
  if (query.isPending) return <PageSkeleton variant="detail" />;
  if (query.isError)
    return <ReceiptLoadError error={query.error} onRetry={() => void query.refetch()} />;
  const receipt = query.data;
  const canCount = allowedReceiptActions(
    {
      status: receipt.status,
      lineCount: receipt.lines.length,
      withoutPo: receipt.withoutPurchaseOrder,
    },
    can,
  ).some(({ action }) => action.code === "saveLines");

  return (
    // Giao diện kiểu Vercel như chi tiết sản phẩm (globals.css `.surface-soft`). Không hiện tiêu đề —
    // breadcrumb topbar đã có số phiếu và link về danh sách; h1 giữ cho screen reader.
    <div className="surface-soft surface-compact">
      <h1 className="sr-only">{receipt.number}</h1>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <ReceiptInfo receipt={receipt} />
          {receipt.status === RECEIPT_STATUS.DRAFT && receipt.withoutPurchaseOrder ? (
            // BR-RCP-002: không có dòng PO → kiểm đếm bằng SKU, không cần đọc PO
            <BlindCountPanel
              receipt={receipt}
              canCount={can(GOODS_RECEIPT_PERMISSIONS.update)}
              onDirtyChange={onDirtyChange}
            />
          ) : receipt.status === RECEIPT_STATUS.DRAFT ? (
            <DraftCountPanel
              receipt={receipt}
              canCount={canCount}
              canUpdate={can(GOODS_RECEIPT_PERMISSIONS.update)}
              onDirtyChange={onDirtyChange}
            />
          ) : receipt.status === RECEIPT_STATUS.PENDING_APPROVAL ? (
            // BR-RCP-001: đếm vượt dung sai → chờ Quản lý kho duyệt, CHƯA ghi nhận tồn; số đếm chỉ còn xem
            <>
              <Alert tone="warning" title={UI_LABELS.receipt.overTolerance.pendingTitle}>
                {receipt.withoutPurchaseOrder
                  ? UI_LABELS.receipt.blind.pendingDescription
                  : UI_LABELS.receipt.overTolerance.pendingDescription}
              </Alert>
              <Section
                title="Dòng chờ duyệt"
                description={UI_LABELS.receipt.linesPendingDescription}
              >
                <ReceiptLinesTable receipt={receipt} draft />
              </Section>
            </>
          ) : receipt.status === RECEIPT_STATUS.CANCELLED ? (
            // Huỷ chỉ từ DRAFT (BR-05) → chưa nhập kho, không có QC / putaway: hiện như kết quả kiểm đếm
            <Section
              title="Dòng kiểm đếm"
              description={UI_LABELS.receipt.linesCancelledDescription}
            >
              <ReceiptLinesTable receipt={receipt} draft />
            </Section>
          ) : (
            <Section title="Dòng nhận" description={UI_LABELS.receipt.linesConfirmedDescription}>
              <ReceiptLinesTable
                receipt={receipt}
                onLineAction={(code, line) => setLineDialog({ code, line })}
              />
            </Section>
          )}
          {/* Owner NOPO-ATTACH: PO gắn bổ sung chỉ là tham chiếu, ở mọi bước trước khi huỷ */}
          {receipt.withoutPurchaseOrder && <ReferencedPoCard receipt={receipt} />}
        </div>
        <div className="space-y-5">
          <ReceiptActions receipt={receipt} hasUnsavedCount={dirty} />
          <ReceiptOverviewCard receipt={receipt} />
        </div>
      </div>
      {lineDialog?.code === "moveToQc" && (
        <MoveToQcDialog
          receiptId={receipt.id}
          line={lineDialog.line}
          onClose={() => setLineDialog(null)}
        />
      )}
      {lineDialog?.code === "inspect" && (
        <InspectDialog
          receiptId={receipt.id}
          line={lineDialog.line}
          onClose={() => setLineDialog(null)}
        />
      )}
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
