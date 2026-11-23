"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileCode2, FileDown } from "lucide-react";

import { EINVOICE_LABELS } from "@/constants/labels-einvoice";
import {
  EINVOICE_LIMITS,
  EINVOICE_ROUTES,
  UNSENDABLE_REVERSAL_REASON_CODE,
} from "@/constants/einvoice";
import { BUSINESS_DOCUMENT_PATHS } from "@/lib/api/business-documents";
import { ApiError } from "@/lib/api/error";
import { usePermissionChecker } from "@/lib/auth/components/Can";
import { DocumentDownloadButton } from "@/components/backoffice/DocumentDownloadButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormField, fieldA11y } from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { einvoiceErrorMessage, outOfDateWarnings, withdrawalRefusal } from "../errors";
import { agreementDraftAvailable, allowedEInvoiceActions } from "../lifecycle";
import {
  useIssueEInvoice,
  useReconcileEInvoice,
  useReduceFailedDelivery,
  useRefreshBuyer,
  useReopenEInvoice,
  useResubmitEInvoice,
  useVoidDraft,
  useWithdrawEInvoice,
} from "../mutations";
import { useCorrections } from "../queries";
import { issueLooksLate, warningMessages } from "../selectors";

import { AgreementDialog } from "./AgreementDialog";
import { CorrectionDialog } from "./CorrectionDialog";
import { ErrorNoticeDialog } from "./ErrorNoticeDialog";
import { ExternalReductionDialog } from "./ExternalReductionDialog";
import { CONFIRM, LATE_REASON_LABEL, SUPPORT_REFERENCE_LABEL } from "./confirm-copy";
import { PortalResultDialog } from "./PortalResultDialog";
import { ReviseDraftDialog } from "./ReviseDraftDialog";
import { useFileDownload } from "./useFileDownload";

import type { ReactNode } from "react";
import type { EInvoiceAction } from "../lifecycle";
import type { EInvoice } from "../types";
import type { Confirmable } from "./confirm-copy";

const A = EINVOICE_LABELS.actions;
const SUPPORT_ID = "einvoice-withdraw-support";

/**
 * Thanh hành động của hoá đơn: nút theo `allowedEInvoiceActions` (trạng thái + quyền + điều chỉnh / thay thế đã có);
 * thao tác phá huỷ / ra ngoài hệ thống phải xác nhận; điều chỉnh / thay thế / thoả thuận / ghi từ cổng NCC mở hộp
 * thoại riêng (docs 21 §4.4; WF-05 Q-8). `extra` gắn thêm nút do màn khác cung cấp.
 *
 * Phát hành tay (WF-05 F-16, Q-10): gửi kèm các cảnh báo Kế toán đã thấy (`acknowledgedWarnings`); BE kiểm lại nháp,
 * có cảnh báo mới → 409 kèm danh sách, hộp thoại hiện chúng và lần bấm sau xác nhận cả chúng. Nháp thành "lập trễ"
 * (ngày giao đã qua) → bắt buộc lý do; BE cũng có thể đòi lý do (400) — khi đó ô lý do hiện ra.
 */
export function EInvoiceActions({
  invoice,
  extra,
}: {
  invoice: EInvoice;
  extra?: (action: EInvoiceAction) => ReactNode;
}) {
  const router = useRouter();
  const can = usePermissionChecker();
  const issued = invoice.status === "ISSUED";
  const corrections = useCorrections(issued ? invoice.id : null);
  const actions = allowedEInvoiceActions(invoice, can, issued ? corrections.data : undefined);
  const [confirming, setConfirming] = useState<Confirmable | null>(null);
  const [revising, setRevising] = useState(false);
  const [correcting, setCorrecting] = useState<"adjust" | "replace" | null>(null);
  const [agreeing, setAgreeing] = useState(false);
  const [noticing, setNoticing] = useState(false);
  const [recordingPortal, setRecordingPortal] = useState(false);
  const [recordingReduction, setRecordingReduction] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Cảnh báo mới BE báo ở lần phát hành trước (F-16) — lần sau xác nhận cả chúng. */
  const [newWarnings, setNewWarnings] = useState<string[]>([]);
  /** BE đòi lý do lập trễ (400 EINVOICE_LATE_ISSUE_REASON_REQUIRED) dù FE không đoán ra. */
  const [lateAsked, setLateAsked] = useState(false);
  /** NCC không xác nhận được kết quả → rút phải kèm văn bản của hỗ trợ NCC (Q-5). */
  const [evidenceAsked, setEvidenceAsked] = useState(false);
  const [supportReference, setSupportReference] = useState("");
  const files = useFileDownload(invoice.id);
  const onError = (failure: unknown) => setError(einvoiceErrorMessage(failure));
  const close = () => {
    setConfirming(null);
    setError(null);
    setNewWarnings([]);
    setLateAsked(false);
    setEvidenceAsked(false);
    setSupportReference("");
  };
  const versioned = { id: invoice.id, version: invoice.version };
  const issue = useIssueEInvoice();
  const voidDraft = useVoidDraft();
  const resubmit = useResubmitEInvoice();
  const reopen = useReopenEInvoice();
  const refresh = useRefreshBuyer();
  const reconcile = useReconcileEInvoice();
  const withdraw = useWithdrawEInvoice();
  const reduce = useReduceFailedDelivery();
  const pending = [issue, voidDraft, resubmit, reopen, withdraw, reduce].some((m) => m.isPending);

  const lateRequired = confirming === "issue" && (issueLooksLate(invoice) || lateAsked);
  const supportMissing =
    confirming === "withdraw" && evidenceAsked && supportReference.trim() === "";

  const onIssueError = (failure: unknown) => {
    onError(failure);
    const fresh = outOfDateWarnings(failure);
    if (fresh.length > 0) setNewWarnings((seen) => [...new Set([...seen, ...fresh])]);
    if (failure instanceof ApiError && failure.code === "EINVOICE_LATE_ISSUE_REASON_REQUIRED")
      setLateAsked(true);
  };
  const onWithdrawError = (failure: unknown) => {
    onError(failure);
    if (withdrawalRefusal(failure)?.evidenceRequired) setEvidenceAsked(true);
  };

  const confirm = (reason?: string) => {
    const done = { onSuccess: close, onError };
    if (confirming === "issue")
      issue.mutate(
        {
          ...versioned,
          acknowledgedWarnings: [...new Set([...invoice.warnings, ...newWarnings])],
          lateReason: lateRequired ? reason : undefined,
        },
        { onSuccess: close, onError: onIssueError },
      );
    if (confirming === "resubmit") resubmit.mutate(versioned, done);
    if (confirming === "reopen") reopen.mutate(versioned, done);
    if (confirming === "void") voidDraft.mutate({ ...versioned, reason: reason ?? "" }, done);
    if (confirming === "voidUnsendable")
      voidDraft.mutate(
        { ...versioned, reason: reason ?? "", reasonCode: UNSENDABLE_REVERSAL_REASON_CODE },
        done,
      );
    if (confirming === "withdraw")
      withdraw.mutate(
        { ...versioned, reason: reason ?? "", supportReference },
        { onSuccess: close, onError: onWithdrawError },
      );
    if (confirming === "reduceFailedDelivery")
      reduce.mutate(versioned, {
        onSuccess: (drawn) => {
          close();
          // BE trả bản giảm vừa lập — mở nó để Kế toán phát hành
          if (drawn.id !== invoice.id) router.push(EINVOICE_ROUTES.detail(drawn.id));
        },
        onError,
      });
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

  const issueWarnings = warningMessages({
    ...invoice,
    warnings: [...new Set([...invoice.warnings, ...newWarnings])],
  });
  const confirmChildren =
    confirming === "issue" ? (
      issueWarnings.length > 0 || lateRequired ? (
        <div className="space-y-2 text-[0.8125rem]">
          {issueWarnings.length > 0 && (
            <>
              <p className="text-ink-primary font-medium">
                Phát hành nghĩa là đã xem các cảnh báo sau:
              </p>
              <ul className="text-ink-secondary list-disc space-y-1 pl-5">
                {issueWarnings.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </>
          )}
          {lateRequired && (
            <p className="text-ink-primary">
              Ngày giao đã qua: hoá đơn mang ngày hôm nay và nhãn “Lập trễ”. Nhập lý do phát hành
              trễ.
            </p>
          )}
        </div>
      ) : undefined
    ) : confirming === "withdraw" ? (
      <FormField
        id={SUPPORT_ID}
        label={SUPPORT_REFERENCE_LABEL}
        required={evidenceAsked}
        hint={evidenceAsked ? undefined : "Bắt buộc khi nhà cung cấp không xác nhận được kết quả."}
      >
        <Input
          {...fieldA11y(SUPPORT_ID, undefined, !evidenceAsked)}
          maxLength={EINVOICE_LIMITS.supportReferenceMax}
          value={supportReference}
          onChange={(event) => setSupportReference(event.target.value)}
        />
      </FormField>
    ) : undefined;

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
      {button("recordPortalResult", A.recordPortalResult, () => setRecordingPortal(true))}
      {button("reopen", A.reopen, () => setConfirming("reopen"))}
      {button("void", A.void, () => setConfirming("void"))}
      {button("voidUnsendable", A.voidUnsendable, () => setConfirming("voidUnsendable"))}
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
      {agreementDraftAvailable(invoice) && (
        <DocumentDownloadButton
          kind="einvoiceAgreementDraft"
          path={BUSINESS_DOCUMENT_PATHS.einvoiceAgreementDraft(invoice.id)}
        />
      )}
      {button("attachAgreement", A.attachAgreement, () => setAgreeing(true))}
      {button("adjust", A.adjust, () => setCorrecting("adjust"))}
      {button("replace", A.replace, () => setCorrecting("replace"))}
      {button("reduceFailedDelivery", A.reduceFailedDelivery, () =>
        setConfirming("reduceFailedDelivery"),
      )}
      {button("recordExternalReduction", A.recordExternalReduction, () =>
        setRecordingReduction(true),
      )}
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
          requireReason={CONFIRM[confirming].reasonLabel !== undefined || lateRequired}
          reasonLabel={lateRequired ? LATE_REASON_LABEL : CONFIRM[confirming].reasonLabel}
          reasonMaxLength={EINVOICE_LIMITS.reasonMax}
          closeOnConfirm={false}
          loading={pending}
          error={error}
          confirmDisabled={supportMissing}
          onConfirm={confirm}
        >
          {confirmChildren}
        </ConfirmDialog>
      )}
      <ReviseDraftDialog invoice={revising ? invoice : null} onClose={() => setRevising(false)} />
      <CorrectionDialog invoice={invoice} mode={correcting} onClose={() => setCorrecting(null)} />
      <AgreementDialog invoice={agreeing ? invoice : null} onClose={() => setAgreeing(false)} />
      <ErrorNoticeDialog invoice={noticing ? invoice : null} onClose={() => setNoticing(false)} />
      <PortalResultDialog
        invoice={recordingPortal ? invoice : null}
        onClose={() => setRecordingPortal(false)}
      />
      <ExternalReductionDialog
        invoice={recordingReduction ? invoice : null}
        onClose={() => setRecordingReduction(false)}
      />
    </div>
  );
}
