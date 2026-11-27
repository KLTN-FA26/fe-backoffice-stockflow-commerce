"use client";

import Link from "next/link";
import { useState } from "react";
import { FileSignature } from "lucide-react";

import {
  ADMIN_ROUTES,
  SALES_CONTRACT_PERMISSIONS,
  SALES_CONTRACT_SIGNED_STATUSES,
  SALES_CONTRACT_STATUS_LABELS,
  SALES_CONTRACT_STATUS_TONE_KEY,
} from "@/constants";
import { PAYMENT_INSTALLMENT_PERMISSIONS } from "@/constants/payment";
import { ApiError } from "@/lib/api/error";
import { Card } from "@/components/shared/Card";
import { Notice } from "@/components/shared/Notice";
import { StatusDot } from "@/components/shared/StatusDot";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import { useOrderInstallmentsSummary } from "../../queries";
import { contractErrorMessage, useCreateSalesContract } from "../../sales-contract-mutations";
import { useSalesContract } from "../../sales-contract-queries";
import {
  allowedContractActions,
  contractPapers,
  signOutcomeText,
} from "../../sales-contract-rules";

import { ContractActions } from "./ContractActions";
import { CancelledContractNotice } from "./CancelledContractNotice";
import { ContractCreditReviewNotice } from "./ContractCreditReviewNotice";
import { ContractCreditWarning } from "./ContractCreditWarning";
import { ContractEditor } from "./ContractEditor";
import { ContractHistory } from "./ContractHistory";
import { ContractLoadState } from "./ContractLoadState";
import { ContractSummary } from "./ContractSummary";

import type { PermissionCode } from "@/lib/auth/me-permissions";
import type { Order } from "../../types";
import type { ContractDialog } from "./ContractActions";

/** Khối "Hợp đồng" của chi tiết đơn (WF-02 pha B, docs 14 §4.3 bước 11–16), neo `#contract`. */
export function OrderContractSection({
  order,
  can,
}: {
  order: Order;
  can: (code: PermissionCode) => boolean;
}) {
  const canRead = can(SALES_CONTRACT_PERMISSIONS.read);
  const query = useSalesContract(order.orderId, canRead);
  const create = useCreateSalesContract();
  const [editing, setEditing] = useState(false);
  const [signed, setSigned] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [dialog, setDialog] = useState<ContractDialog>(null);
  const [legalMissing, setLegalMissing] = useState<string | null>(null);
  const contract = query.data ?? null;
  // BO-UX-28: hợp đồng đã ký → đợt thật (hạn, đã thu / còn), khi người xem đọc được các đợt.
  const signedContract =
    !!contract && (SALES_CONTRACT_SIGNED_STATUSES as readonly string[]).includes(contract.status);
  const installments = useOrderInstallmentsSummary(order.orderId, {
    enabled: canRead && signedContract && can(PAYMENT_INSTALLMENT_PERMISSIONS.read),
  });
  if (!canRead) return null;

  const actions = query.isSuccess ? allowedContractActions(contract, order.status, can) : [];
  const outcome = signed ? signOutcomeText(order) : null;
  const startContract = () => {
    setLegalMissing(null);
    create.mutate(
      { orderId: order.orderId },
      {
        onSuccess: () => setEditing(true),
        onError: (error) => {
          // Khách chưa có hồ sơ pháp lý: không chỉ toast, dẫn Sale tới nơi nhập (không import `features/customer`).
          if (error instanceof ApiError && error.code === "CUSTOMER_LEGAL_PROFILE_MISSING")
            setLegalMissing(contractErrorMessage(error));
          else toast.error(contractErrorMessage(error));
        },
      },
    );
  };

  return (
    <Card className="scroll-mt-20 space-y-3">
      <section id="contract" aria-labelledby="contract-title" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2
            id="contract-title"
            className="text-ink-primary flex items-center gap-2 text-sm font-semibold"
          >
            <FileSignature className="size-3.5" /> Hợp đồng
            {contract && (
              <span className="font-[family-name:var(--font-mono)] font-normal">
                {contract.contractNumber}
              </span>
            )}
          </h2>
          {contract && (
            <StatusDot
              domain="order"
              status={SALES_CONTRACT_STATUS_TONE_KEY[contract.status]}
              label={SALES_CONTRACT_STATUS_LABELS[contract.status]}
            />
          )}
        </div>
        {outcome && <Notice tone="positive">{outcome}</Notice>}
        {query.isPending || query.isError ? (
          <ContractLoadState
            error={query.isError ? query.error : null}
            onRetry={() => void query.refetch()}
          />
        ) : (
          <>
            {!contract && (
              <>
                <p className="text-ink-tertiary text-[0.8125rem]">Đơn chưa có hợp đồng.</p>
                <CancelledContractNotice orderId={order.orderId} />
              </>
            )}
            {legalMissing && (
              <Notice tone="warning" live>
                <span>
                  {legalMissing}{" "}
                  {order.customerId && (
                    <Link
                      href={ADMIN_ROUTES.customers.legalProfile(
                        order.customerId,
                        ADMIN_ROUTES.orders.contract(order.orderId),
                      )}
                      className="text-accent-text font-medium hover:underline"
                    >
                      Nhập thông tin pháp lý
                    </Link>
                  )}
                </span>
              </Notice>
            )}
            {actions.includes("create") && (
              <Button size="sm" disabled={create.isPending} onClick={startContract}>
                {contract ? "Lập hợp đồng mới" : "Lập hợp đồng"}
              </Button>
            )}
            {contract && contract.status !== "CANCELLED" && (
              <>
                <ContractCreditReviewNotice
                  contract={contract}
                  canWithdraw={actions.includes("withdraw-review")}
                />
                {contract.status === "DRAFT" && contract.creditReview !== "PENDING" && (
                  <ContractCreditWarning
                    contract={contract}
                    onEdit={actions.includes("edit") ? () => setEditing(true) : undefined}
                    onSend={actions.includes("send") ? () => setDialog("send") : undefined}
                  />
                )}
                <ContractActions
                  contract={contract}
                  actions={actions}
                  onEdit={() => setEditing(true)}
                  onSigned={() => setSigned(true)}
                  dialog={dialog}
                  setDialog={setDialog}
                  papers={contractPapers(contract, order.status)}
                />
                {editing && contract.status === "DRAFT" && contract.creditReview !== "PENDING" ? (
                  <ContractEditor
                    contract={contract}
                    order={order}
                    onDone={() => setEditing(false)}
                  />
                ) : (
                  <ContractSummary
                    contract={contract}
                    installments={installments.data?.installments}
                  />
                )}
              </>
            )}
            <button
              type="button"
              className="text-accent-text text-xs hover:underline"
              aria-expanded={showHistory}
              aria-controls="contract-history"
              onClick={() => setShowHistory((v) => !v)}
            >
              {showHistory ? "Ẩn lịch sử hợp đồng" : "Xem lịch sử hợp đồng"}
            </button>
            <div id="contract-history">
              {showHistory && <ContractHistory orderId={order.orderId} />}
            </div>
          </>
        )}
      </section>
    </Card>
  );
}
