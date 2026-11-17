"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCheck, XCircle } from "lucide-react";

import { ADMIN_ROUTES } from "@/constants";
import { RETURN_RECEIPT_LABELS } from "@/constants/labels-return";
import { GOODS_RECEIPT_PERMISSIONS } from "@/constants/permissions";
import { RETURN_ROUTES } from "@/constants/returns";
import { useCan, usePermissionChecker } from "@/lib/auth/components/Can";
import { PermissionBoundary } from "@/lib/auth/components/PermissionBoundary";
import { useBreadcrumbLabel } from "@/lib/store/use-breadcrumb-labels";
import { LoadErrorState } from "@/components/backoffice/LoadErrorState";
import { Card } from "@/components/shared/Card";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { returnErrorMessage } from "../errors";
import { allowedReturnReceiptActions } from "../lifecycle";
import {
  useCancelReturnReceipt,
  useConfirmReturnReceipt,
  useRemoveReturnCarton,
} from "../mutations";
import { useReturnReceipt } from "../queries";

import {
  CodeLink,
  InfoList,
  InfoRow,
  RETURN_RECEIPT_COPY,
  ReturnReceiptStatusDot,
  When,
} from "./primitives";
import { ReturnCartonScan } from "./ReturnCartonScan";
import { ReturnCartonTables } from "./ReturnCartonTables";

const L = RETURN_RECEIPT_LABELS;
const D = L.detail;

function Content({ id }: { id: string }) {
  const canRead = useCan(GOODS_RECEIPT_PERMISSIONS.read);
  const can = usePermissionChecker();
  const query = useReturnReceipt(id, { enabled: canRead });
  useBreadcrumbLabel(id, query.data?.number);
  const [open, setOpen] = useState<"confirm" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirmReturnReceipt();
  const cancel = useCancelReturnReceipt();
  const remove = useRemoveReturnCarton();
  const back = { href: RETURN_ROUTES.receipts.list };
  if (!canRead)
    return <LoadErrorState error={null} kind="no-read" copy={RETURN_RECEIPT_COPY} back={back} />;
  if (query.isError)
    return (
      <LoadErrorState
        error={query.error}
        copy={RETURN_RECEIPT_COPY}
        back={back}
        onRetry={() => void query.refetch()}
      />
    );
  if (query.isPending) return <PageSkeleton variant="detail" />;
  const receipt = query.data;
  // UI-only — Backend phải re-check (`procurement-goods-receipts:UPDATE`, phiếu DRAFT)
  const actions = allowedReturnReceiptActions(receipt, can);
  const close = () => {
    setOpen(null);
    setError(null);
  };
  const onError = (failure: unknown) => setError(returnErrorMessage(failure));

  return (
    <div className="surface-soft surface-compact space-y-4">
      <h1 className="sr-only">{`${L.pageTitle} ${receipt.number}`}</h1>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={RETURN_ROUTES.receipts.list}>
            <ArrowLeft className="size-3.5" /> {L.pageTitle}
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          {actions.includes("confirm") && (
            <Button size="sm" onClick={() => setOpen("confirm")}>
              <CheckCheck className="size-3.5" /> {D.confirm}
            </Button>
          )}
          {actions.includes("cancel") && (
            <Button size="sm" variant="outline" onClick={() => setOpen("cancel")}>
              <XCircle className="size-3.5" /> {D.cancel}
            </Button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          {actions.includes("scan") && <ReturnCartonScan receiptId={receipt.id} />}
          <ReturnCartonTables
            receipt={receipt}
            removing={remove.isPending}
            onRemove={
              actions.includes("remove")
                ? (lpn) => remove.mutate({ id: receipt.id, lpn })
                : undefined
            }
          />
        </div>
        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-ink-primary font-[family-name:var(--font-mono)] text-sm font-semibold">
              {receipt.number}
            </h2>
            <ReturnReceiptStatusDot status={receipt.status} />
          </div>
          <InfoList>
            <InfoRow label={D.source}>
              {receipt.returnRequestId ? (
                <CodeLink href={RETURN_ROUTES.detail(receipt.returnRequestId)}>
                  {L.source.rma(receipt.rmaNumber ?? "")}
                </CodeLink>
              ) : (
                L.source.shipment(receipt.shipmentCode ?? receipt.shipmentId ?? "")
              )}
            </InfoRow>
            {receipt.orderId && (
              <InfoRow label={D.order}>
                <CodeLink href={ADMIN_ROUTES.orders.detail(receipt.orderId)}>
                  {receipt.orderNumber ?? receipt.orderId}
                </CodeLink>
              </InfoRow>
            )}
            <InfoRow label={D.quarantine}>
              <span className="font-[family-name:var(--font-mono)]">
                {receipt.quarantineLocationCode ?? "—"}
              </span>
            </InfoRow>
            <InfoRow label={D.receivedAt}>
              <When iso={receipt.receivedAt} />
            </InfoRow>
            <InfoRow label={D.confirmedAt}>
              <When iso={receipt.closedAt ?? receipt.confirmedAt} />
            </InfoRow>
            {receipt.note && <InfoRow label={D.note}>{receipt.note}</InfoRow>}
          </InfoList>
        </Card>
      </div>
      <ConfirmDialog
        open={open === "confirm"}
        onOpenChange={(next) => !next && close()}
        title={D.confirmTitle}
        description={D.confirmDescription}
        confirmLabel={D.confirm}
        closeOnConfirm={false}
        loading={confirm.isPending}
        error={error}
        onConfirm={() => confirm.mutate({ id: receipt.id }, { onSuccess: close, onError })}
      />
      <ConfirmDialog
        open={open === "cancel"}
        onOpenChange={(next) => !next && close()}
        title={D.cancelTitle}
        description={D.cancelDescription}
        confirmLabel={D.cancel}
        variant="danger"
        closeOnConfirm={false}
        loading={cancel.isPending}
        error={error}
        onConfirm={() => cancel.mutate({ id: receipt.id }, { onSuccess: close, onError })}
      />
    </div>
  );
}

/**
 * Một phiếu nhập hàng hoàn: quét LPN vào phiếu nháp, đối chiếu với thùng của nguồn, xác nhận (thùng về tồn cách ly,
 * RMA → RECEIVED) hoặc huỷ (docs 03 §4.2 bước 10–12, BR-05, BR-14).
 */
export function ReturnReceiptDetail({ id }: { id: string }) {
  return (
    <PermissionBoundary permissions={[GOODS_RECEIPT_PERMISSIONS.viewPage]}>
      <Content id={id} />
    </PermissionBoundary>
  );
}
