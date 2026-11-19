"use client";

import { useState } from "react";
import { FileCode2, FileDown } from "lucide-react";

import { EINVOICE_LABELS } from "@/constants/labels-einvoice";
import { EINVOICE_LIMITS } from "@/constants/einvoice";
import { usePermissionChecker } from "@/lib/auth/components/Can";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";

import { einvoiceErrorMessage } from "../errors";
import { allowedEInvoiceActions } from "../lifecycle";
import {
  useIssueEInvoice,
  useReconcileEInvoice,
  useRefreshBuyer,
  useReopenEInvoice,
  useResubmitEInvoice,
  useVoidDraft,
  useWithdrawEInvoice,
} from "../mutations";
import { useProviderCalls } from "../queries";
import { lastSentAt } from "../selectors";

import { AgreementDialog } from "./AgreementDialog";
import { CorrectionDialog } from "./CorrectionDialog";
import { ErrorNoticeDialog } from "./ErrorNoticeDialog";
import { CONFIRM } from "./confirm-copy";
import { ReviseDraftDialog } from "./ReviseDraftDialog";
import { useFileDownload } from "./useFileDownload";

import type { ReactNode } from "react";
import type { EInvoiceAction } from "../lifecycle";
import type { EInvoice } from "../types";
import type { Confirmable } from "./confirm-copy";

const A = EINVOICE_LABELS.actions;
/**
 * Thanh hành động của hoá đơn: nút theo `allowedEInvoiceActions` (trạng thái + quyền); thao tác phá
 * huỷ / ra ngoài hệ thống phải xác nhận; điều chỉnh / thay thế / thoả thuận mở hộp thoại riêng
 * (docs 21 §4.4). `extra` gắn thêm nút do màn khác cung cấp.
 */
export function EInvoiceActions({
  invoice,
  readAt,
  extra,
}: {
  invoice: EInvoice;
  /** Lúc đọc hoá đơn (`dataUpdatedAt`, ms) — mốc "bây giờ" của gate theo thời gian (rút hoá đơn). */
  readAt?: number;
  extra?: (action: EInvoiceAction) => ReactNode;
}) {
  const can = usePermissionChecker();
  // Nhật ký gọi NCC dùng chung cache với ProviderCallsCard — chỉ cần khi đang chờ NCC (mốc rút hoá đơn)
  const calls = useProviderCalls(invoice.status === "SUBMITTING" ? invoice.id : null);
  const actions = allowedEInvoiceActions(
    invoice,
    can,
    readAt === undefined ? undefined : { now: readAt, lastSentAt: lastSentAt(invoice, calls.data) },
  );
  const [confirming, setConfirming] = useState<Confirmable | null>(null);
  const [revising, setRevising] = useState(false);
  const [correcting, setCorrecting] = useState<"adjust" | "replace" | null>(null);
  const [agreeing, setAgreeing] = useState(false);
  const [noticing, setNoticing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const files = useFileDownload(invoice.id);
  const onError = (failure: unknown) => setError(einvoiceErrorMessage(failure));
  const close = () => {
    setConfirming(null);
    setError(null);
  };
  const versioned = { id: invoice.id, version: invoice.version };
  const issue = useIssueEInvoice();
  const voidDraft = useVoidDraft();
  const resubmit = useResubmitEInvoice();
  const reopen = useReopenEInvoice();
  const refresh = useRefreshBuyer();
  const reconcile = useReconcileEInvoice();
  const withdraw = useWithdrawEInvoice();
  const pending = [issue, voidDraft, resubmit, reopen, withdraw].some((m) => m.isPending);

  const confirm = (reason?: string) => {
    const done = { onSuccess: close, onError };
    if (confirming === "issue") issue.mutate(versioned, done);
    if (confirming === "resubmit") resubmit.mutate(versioned, done);
    if (confirming === "reopen") reopen.mutate(versioned, done);
    if (confirming === "void") voidDraft.mutate({ ...versioned, reason: reason ?? "" }, done);
    if (confirming === "withdraw") withdraw.mutate({ ...versioned, reason: reason ?? "" }, done);
  };
  const button = (action: EInvoiceAction, label: string, onClick: () => void, busy = false) =>
    actions.includes(action) ? (
      <Button
        key={action}
        size="sm"
        variant={action === "issue" ? "default" : "outline"}
        disabled={busy}
        onClick={onClick}
      >
        {label}
      </Button>
    ) : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {button("revise", A.revise, () => setRevising(true))}
      {button(
        "refreshBuyer",
        A.refreshBuyer,
        () => refresh.mutate(versioned, { onError }),
        refresh.isPending,
      )}
      {button(
        "reconcile",
        A.reconcile,
        () => reconcile.mutate({ id: invoice.id }, { onError }),
        reconcile.isPending,
      )}
      {button("resubmit", A.resubmit, () => setConfirming("resubmit"))}
      {button("withdraw", A.withdraw, () => setConfirming("withdraw"))}
      {button("reopen", A.reopen, () => setConfirming("reopen"))}
      {button("void", A.void, () => setConfirming("void"))}
      {actions.includes("downloadFiles") && (
        <>
          <Button
            size="sm"
            variant="outline"
            disabled={files.busy !== null}
            onClick={() => void files.download("PDF")}
          >
            <FileDown className="size-3.5" /> {A.downloadPdf}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={files.busy !== null}
            onClick={() => void files.download("XML")}
          >
            <FileCode2 className="size-3.5" /> {A.downloadXml}
          </Button>
        </>
      )}
      {button("attachAgreement", A.attachAgreement, () => setAgreeing(true))}
      {button("adjust", A.adjust, () => setCorrecting("adjust"))}
      {button("replace", A.replace, () => setCorrecting("replace"))}
      {button("notifyError", A.notifyError, () => setNoticing(true))}
      {actions.map((action) => extra?.(action))}
      {button("issue", A.issue, () => setConfirming("issue"))}
      {(error ?? files.error) && !confirming && (
        <p role="alert" className="text-danger w-full text-[0.8125rem]">
          {error ?? files.error}
        </p>
      )}
      {confirming && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && close()}
          title={CONFIRM[confirming].title}
          description={CONFIRM[confirming].description}
          confirmLabel={A[confirming]}
          variant={CONFIRM[confirming].danger ? "danger" : "default"}
          requireReason={CONFIRM[confirming].reasonLabel !== undefined}
          reasonLabel={CONFIRM[confirming].reasonLabel}
          reasonMaxLength={EINVOICE_LIMITS.reasonMax}
          closeOnConfirm={false}
          loading={pending}
          error={error}
          onConfirm={confirm}
        />
      )}
      <ReviseDraftDialog invoice={revising ? invoice : null} onClose={() => setRevising(false)} />
      <CorrectionDialog invoice={invoice} mode={correcting} onClose={() => setCorrecting(null)} />
      <AgreementDialog invoice={agreeing ? invoice : null} onClose={() => setAgreeing(false)} />
      <ErrorNoticeDialog invoice={noticing ? invoice : null} onClose={() => setNoticing(false)} />
    </div>
  );
}
