"use client";

import { Pencil, Send, Signature } from "lucide-react";

import { formatMoney } from "@/lib/format/money";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import {
  contractErrorMessage,
  useCancelSalesContract,
  useSendSalesContract,
} from "../../sales-contract-mutations";
import { creditWarningText } from "../../sales-contract-rules";

import { ContractDownloads } from "./ContractDownloads";
import { SignContractDialog } from "./SignContractDialog";

import type { ContractAction } from "../../sales-contract-rules";
import type { SalesContract } from "../../sales-contract-schemas";

export type ContractDialog = "send" | "sign" | "cancel" | null;

/** Nút hợp đồng theo trạng thái (`allowedContractActions`) + tải PDF / bản đã gửi / bản đã ký. */
export function ContractActions({
  contract,
  actions,
  onEdit,
  onSigned,
  dialog,
  setDialog,
}: {
  contract: SalesContract;
  actions: readonly ContractAction[];
  onEdit: () => void;
  onSigned: () => void;
  /** Hộp thoại đang mở — do khối cha giữ để banner cảnh báo mở được "Vẫn gửi". */
  dialog: ContractDialog;
  setDialog: (dialog: ContractDialog) => void;
}) {
  const send = useSendSalesContract();
  const cancel = useCancelSalesContract();
  const close = () => setDialog(null);
  const onError = (error: unknown) => toast.error(contractErrorMessage(error));
  const money = (amount: number) => formatMoney(amount, contract.totals.currency);
  const warning = contract.creditWarning;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ContractDownloads
        contract={contract}
        canPreview={actions.includes("preview")}
        onError={onError}
      />
      {actions.includes("cancel") && (
        <Button
          size="sm"
          variant="outline"
          className="text-danger"
          onClick={() => setDialog("cancel")}
        >
          Huỷ hợp đồng
        </Button>
      )}
      {actions.includes("edit") && (
        <Button size="sm" variant="outline" onClick={onEdit}>
          <Pencil className="size-3.5" /> Sửa
        </Button>
      )}
      {actions.includes("send") && (
        <Button size="sm" onClick={() => setDialog("send")}>
          <Send className="size-3.5" /> Gửi hợp đồng
        </Button>
      )}
      {actions.includes("sign") && (
        <Button size="sm" onClick={() => setDialog("sign")}>
          <Signature className="size-3.5" /> Ghi nhận đã ký
        </Button>
      )}

      <ConfirmDialog
        open={dialog === "send"}
        onOpenChange={(next) => !next && close()}
        title={warning ? "Vẫn gửi hợp đồng?" : "Gửi hợp đồng cho khách?"}
        description={
          warning
            ? `${creditWarningText(warning, money)} Hợp đồng vẫn được gửi; Kế toán quyết định khi khách ký.`
            : "Đơn chuyển sang Chờ ký hợp đồng. Muốn sửa sau khi gửi phải huỷ hợp đồng rồi lập lại."
        }
        confirmLabel={warning ? "Vẫn gửi" : "Gửi hợp đồng"}
        variant="default"
        loading={send.isPending}
        closeOnConfirm={false}
        onConfirm={() =>
          send.mutate(
            { orderId: contract.orderId, version: contract.version },
            {
              onSuccess: (sent) => {
                close();
                if (sent.creditWarning)
                  toast.warning(`Đã gửi hợp đồng. ${creditWarningText(sent.creditWarning, money)}`);
                else toast.success("Đã gửi hợp đồng cho khách.");
              },
              onError: (error) => {
                close();
                onError(error);
              },
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
