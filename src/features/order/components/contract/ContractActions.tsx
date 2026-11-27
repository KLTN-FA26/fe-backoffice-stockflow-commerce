"use client";

import { useState } from "react";
import { Pencil, Send, Signature, XCircle } from "lucide-react";

import { ORDER_CONTRACT_LABELS } from "@/constants/labels-order-contract";
import { ApiError } from "@/lib/api/error";

import { toLocalIsoDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import {
  contractErrorMessage,
  useCancelSalesContract,
  useSendSalesContract,
} from "../../sales-contract-mutations";
import {
  contractFieldLabel,
  creditWarningText,
  sendBlockers,
  sendBlockersText,
} from "../../sales-contract-rules";

import { ContractDownloads } from "./ContractDownloads";
import { SignContractDialog } from "./SignContractDialog";

import type { ContractAction } from "../../sales-contract-rules";
import type { SalesContract } from "../../sales-contract-schemas";

export type ContractDialog = "send" | "sign" | "cancel" | null;

/**
 * Lỗi gửi hợp đồng TRONG hộp thoại: câu của BE + từng `fieldErrors[]` (vd cửa sổ giao ở quá khứ —
 * `deliverySchedule[0].windowStart`) theo tên đợt, để Sale biết sửa ô nào (WF-02 audit, mục 8).
 */
function SendError({ error }: { error: unknown }) {
  const fields = error instanceof ApiError ? (error.fieldErrorList ?? []) : [];
  // Refused for something the contract does not show beforehand (customer not active, no credit now): say why and who
  // unblocks, in the dialog (R7) — not the bare BE sentence.
  const refusal =
    error instanceof ApiError && error.code in ORDER_CONTRACT_LABELS.sendRefused
      ? ORDER_CONTRACT_LABELS.sendRefused[
          error.code as keyof typeof ORDER_CONTRACT_LABELS.sendRefused
        ]
      : null;
  if (refusal) return <p>{refusal}</p>;
  return (
    <div className="space-y-1">
      <p>{contractErrorMessage(error)}</p>
      {fields.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5">
          {fields.map((entry, index) => (
            <li key={`${entry.field}-${index}`}>
              <span className="font-medium">{contractFieldLabel(entry.field)}:</span>{" "}
              {entry.message}
            </li>
          ))}
        </ul>
      )}
      {fields.length > 0 && <p>{ORDER_CONTRACT_LABELS.sendRefusedFields}</p>}
    </div>
  );
}

/** Nút hợp đồng theo trạng thái (`allowedContractActions`) + tải PDF / bản đã gửi / bản đã ký. */
export function ContractActions({
  contract,
  actions,
  onEdit,
  onSigned,
  dialog,
  setDialog,
  papers = { appendix: false, liquidation: false },
}: {
  contract: SalesContract;
  actions: readonly ContractAction[];
  onEdit: () => void;
  onSigned: () => void;
  /** Hộp thoại đang mở — do khối cha giữ để banner cảnh báo mở được "Gửi Kế toán duyệt". */
  dialog: ContractDialog;
  setDialog: (dialog: ContractDialog) => void;
  /** Phụ lục / biên bản thanh lý mở được chưa (`contractPapers`). */
  papers?: { appendix: boolean; liquidation: boolean };
}) {
  const send = useSendSalesContract();
  const cancel = useCancelSalesContract();
  const [sendError, setSendError] = useState<unknown>(null);
  const close = () => {
    setSendError(null);
    setDialog(null);
  };
  const onError = (error: unknown) => toast.error(contractErrorMessage(error));
  const money = (amount: number) => formatMoney(amount, contract.totals.currency);
  const warning = contract.creditWarning;
  // R7 (S06-3): thiếu cửa sổ giao thì khoá nút và nói thiếu gì ngay dưới nút, không để lỗi hiện sau khi xác nhận.
  const blocked = sendBlockersText(
    sendBlockers(contract, toLocalIsoDate(new Date().toISOString())),
  );

  return (
    <div className="w-full space-y-1.5">
      <div className="flex w-full flex-wrap items-center gap-2">
        {/* BO-UX-27: việc chính trước (Gửi / Ghi nhận đã ký), rồi Sửa, rồi tải PDF; Huỷ hợp đồng cuối, tách riêng. */}
        {actions.includes("send") && (
          <Button
            size="sm"
            disabled={!!blocked}
            aria-describedby={blocked ? "contract-send-blocked" : undefined}
            onClick={() => setDialog("send")}
          >
            <Send className="size-3.5" /> Gửi hợp đồng
          </Button>
        )}
        {actions.includes("sign") && (
          <Button size="sm" onClick={() => setDialog("sign")}>
            <Signature className="size-3.5" /> Ghi nhận đã ký
          </Button>
        )}
        {actions.includes("edit") && (
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Pencil className="size-3.5" /> Sửa
          </Button>
        )}
        <ContractDownloads
          contract={contract}
          canPreview={actions.includes("preview")}
          onError={onError}
          papers={papers}
        />
        {actions.includes("cancel") && (
          <Button
            size="sm"
            variant="ghost"
            className="text-danger hover:text-danger border-border-default ml-auto border-l pl-3"
            onClick={() => setDialog("cancel")}
          >
            <XCircle className="size-3.5" /> Huỷ hợp đồng
          </Button>
        )}
      </div>
      {actions.includes("send") && blocked && (
        <p id="contract-send-blocked" className="text-warning-ink text-xs">
          {blocked}
        </p>
      )}
      <ConfirmDialog
        open={dialog === "send"}
        onOpenChange={(next) => !next && close()}
        title={warning ? "Gửi hợp đồng cho Kế toán duyệt?" : "Gửi hợp đồng cho khách?"}
        description={
          warning
            ? `${creditWarningText(warning, money)} Hợp đồng chưa tới khách cho tới khi Kế toán duyệt; trong lúc chờ không sửa được.`
            : "Đơn chuyển sang Chờ ký hợp đồng. Muốn sửa sau khi gửi phải huỷ hợp đồng rồi lập lại."
        }
        confirmLabel={warning ? "Gửi Kế toán duyệt" : "Gửi hợp đồng"}
        variant="default"
        loading={send.isPending}
        closeOnConfirm={false}
        error={sendError ? <SendError error={sendError} /> : undefined}
        onConfirm={() =>
          send.mutate(
            { orderId: contract.orderId, version: contract.version },
            {
              onSuccess: (sent) => {
                close();
                // 15 BR-11 (BE PR #486): 200 nhưng KHÔNG gửi — vẫn DRAFT, creditReview PENDING chờ Kế toán.
                if (sent.creditReview === "PENDING")
                  toast.warning("Hợp đồng chưa được gửi: đang chờ Kế toán duyệt tín dụng.");
                else toast.success("Đã gửi hợp đồng cho khách.");
              },
              // Giữ hộp thoại mở, hiện lỗi kèm fieldErrors ngay trong đó (dialog modal che phần còn lại).
              onError: setSendError,
            },
          )
        }
      />
      <ConfirmDialog
        open={dialog === "cancel"}
        onOpenChange={(next) => !next && close()}
        title="Huỷ hợp đồng?"
        description="Đơn về Nháp để lập hợp đồng mới. Khách muốn sửa hợp đồng đã gửi → huỷ (ghi lý do) rồi lập lại."
        confirmLabel="Huỷ hợp đồng"
        requireReason
        reasonLabel="Lý do huỷ"
        reasonMaxLength={500}
        loading={cancel.isPending}
        closeOnConfirm={false}
        onConfirm={(reason) =>
          cancel.mutate(
            { orderId: contract.orderId, version: contract.version, reason: reason ?? "" },
            { onSuccess: close, onError },
          )
        }
      />
      <SignContractDialog
        contract={contract}
        open={dialog === "sign"}
        onOpenChange={(next) => !next && close()}
        onSigned={onSigned}
      />
    </div>
  );
}
