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
} from "../mutations";

import { AgreementDialog } from "./AgreementDialog";
import { CorrectionDialog } from "./CorrectionDialog";
import { ReviseDraftDialog } from "./ReviseDraftDialog";
import { useFileDownload } from "./useFileDownload";

import type { ReactNode } from "react";
import type { EInvoiceAction } from "../lifecycle";
import type { EInvoice } from "../types";

const A = EINVOICE_LABELS.actions;
type Confirmable = "issue" | "void" | "resubmit" | "reopen";

const CONFIRM: Record<Confirmable, { title: string; description: string; danger?: boolean }> = {
  issue: {
    title: "Phát hành hoá đơn?",
    description:
      "Hoá đơn được gửi tới nhà cung cấp để ký số, cấp số và nộp cơ quan thuế. Đã phát hành thì không sửa, không xoá — chỉ điều chỉnh hoặc thay thế (BR-03).",
  },
  void: {
    title: "Huỷ hoá đơn nháp?",
    description: "Nháp chưa từng gửi nhà cung cấp sẽ bị huỷ và không dùng lại được.",
    danger: true,
  },
  resubmit: {
    title: "Gửi lại như giao dịch mới?",
    description:
      "Chỉ làm khi nhà cung cấp đã xác nhận KHÔNG giữ hoá đơn này — gửi nhầm có thể thành hai hoá đơn (BR-04, BR-05).",
    danger: true,
  },
  reopen: {
    title: "Mở lại thành nháp?",
    description: "Hoá đơn bị từ chối trở lại nháp để sửa nguyên nhân rồi phát hành lại.",
  },
};

/**
 * Thanh hành động của hoá đơn: nút theo `allowedEInvoiceActions` (trạng thái + quyền); thao tác phá
 * huỷ / ra ngoài hệ thống phải xác nhận; điều chỉnh / thay thế / thoả thuận mở hộp thoại riêng
 * (docs 21 §4.4). `extra` gắn thêm nút do màn khác cung cấp.
 */
export function EInvoiceActions({
  invoice,
  extra,
}: {
  invoice: EInvoice;
  extra?: (action: EInvoiceAction) => ReactNode;
}) {
  const can = usePermissionChecker();
  const actions = allowedEInvoiceActions(invoice, can);
  const [confirming, setConfirming] = useState<Confirmable | null>(null);
  const [revising, setRevising] = useState(false);
  const [correcting, setCorrecting] = useState<"adjust" | "replace" | null>(null);
  const [agreeing, setAgreeing] = useState(false);
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
  const pending = [issue, voidDraft, resubmit, reopen].some((m) => m.isPending);

  const confirm = (reason?: string) => {
    const done = { onSuccess: close, onError };
    if (confirming === "issue") issue.mutate(versioned, done);
    if (confirming === "resubmit") resubmit.mutate(versioned, done);
    if (confirming === "reopen") reopen.mutate(versioned, done);
    if (confirming === "void") voidDraft.mutate({ ...versioned, reason: reason ?? "" }, done);
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
          requireReason={confirming === "void"}
          reasonLabel="Lý do huỷ"
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
    </div>
  );
}
