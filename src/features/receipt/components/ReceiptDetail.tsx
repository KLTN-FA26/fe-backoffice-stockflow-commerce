"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ADMIN_ROUTES, GOODS_RECEIPT_PERMISSIONS, RECEIPT_STATUS, UI_LABELS } from "@/constants";
import { useCan, usePermissionChecker } from "@/lib/auth";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { allowedReceiptActions } from "@/features/receipt/lifecycle";
import { useGoodsReceipt } from "@/features/receipt/queries";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { InspectDialog } from "./detail/InspectDialog";
import { MoveToQcDialog } from "./detail/MoveToQcDialog";
import { ReceiptActions } from "./detail/ReceiptActions";
import { DraftCountPanel } from "./detail/DraftCountPanel";
import { ReceiptInfo, ReceiptOverviewCard } from "./detail/ReceiptInfo";
import { ReceiptLinesTable } from "./detail/ReceiptLinesTable";
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
    { status: receipt.status, lineCount: receipt.lines.length },
    can,
  ).some(({ action }) => action.code === "saveLines");

  return (
    <>
      <PageHeader
        title={receipt.number}
        subtitle={[UI_LABELS.receipt.pageTitle, receipt.purchaseOrderNumber]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href={ADMIN_ROUTES.receipts.list}>
              <ArrowLeft className="size-3.5" /> {UI_LABELS.common.backToList}
            </Link>
          </Button>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-5">
          <ReceiptInfo receipt={receipt} />
          {receipt.status === RECEIPT_STATUS.DRAFT ? (
            <DraftCountPanel
              receipt={receipt}
              canCount={canCount}
              canUpdate={can(GOODS_RECEIPT_PERMISSIONS.update)}
              onDirtyChange={onDirtyChange}
            />
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
    </>
  );
}

export function ReceiptDetail({ id }: { id: string }) {
  return (
    <ReceiptPermissionGate permissions={[GOODS_RECEIPT_PERMISSIONS.viewPage]}>
      <ReceiptDetailBody id={id} />
    </ReceiptPermissionGate>
  );
}
