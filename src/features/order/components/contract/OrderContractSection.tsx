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
import { ORDER_CONTRACT_LABELS } from "@/constants/labels-order-contract";
import { PAYMENT_INSTALLMENT_PERMISSIONS } from "@/constants/payment";
import { ApiError } from "@/lib/api/error";
import { toLocalIsoDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { isSalesOwnerError } from "@/lib/references/sales-owner-access";
import { useSalesOwnerAccess } from "@/lib/references/sales-owner-queries";
import { SalesOwnerAccessNote } from "@/components/backoffice/SalesOwnerNotes";
import { Card } from "@/components/shared/Card";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Notice } from "@/components/shared/Notice";
import { StatusDot } from "@/components/shared/StatusDot";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import { useOrderInstallmentsSummary } from "../../queries";
import { contractErrorMessage, useCreateSalesContract } from "../../sales-contract-mutations";
import { useSalesContract } from "../../sales-contract-queries";
import { contractTermsNeedApproval } from "../../sales-contract-esign-rules";
import {
  allowedContractActions,
  contractPapers,
  isOwnerGatedContractAction,
  sendBlockers,
  sendBlockersText,
  signOutcomeText,
} from "../../sales-contract-rules";

import { scrollToSection } from "../scroll-to-section";

import { ContractEsignActions } from "./ContractEsignActions";
import { ContractEsignBadges } from "./ContractEsignBadges";
import { ContractRevisions } from "./ContractRevisions";
import { ContractSignaturePanel } from "./ContractSignaturePanel";

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

const C = ORDER_CONTRACT_LABELS.create;
const H = ORDER_CONTRACT_LABELS.history;

/**
 * Khối "Hợp đồng" của chi tiết đơn (WF-02 pha B, docs 14 §4.3 bước 11–16), neo `#contract`.
 * bo-19: "Lập hợp đồng" hỏi lại trước (BE lập ngay bản nháp theo mặc định); vừa lập xong thì việc đầu tiên là xem lại
 * ("Sửa" / "Xem trước PDF"), "Gửi hợp đồng" lùi thành nút phụ cho tới khi Sale lưu lại hợp đồng hoặc xem trước PDF.
 * BR-S12 (chế độ chặt): khách do Sale khác phụ trách → Lập / Sửa / Gửi / Huỷ hợp đồng hiện nhưng tắt, kèm lý do; việc vận
 * hành của đơn (BR-S13) không bị chặn.
 */
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
  const [confirmCreate, setConfirmCreate] = useState(false);
  /** Vừa lập trong phiên này, chưa lưu lại / chưa xem PDF — mời xem lại trước khi gửi (bo-19). */
  const [reviewFirst, setReviewFirst] = useState(false);
  const [dialog, setDialog] = useState<ContractDialog>(null);
  const [legalMissing, setLegalMissing] = useState<string | null>(null);
  const contract = query.data ?? null;
  // BR-S12 — UI-only, Backend phải re-check (409 CUSTOMER_OWNED_BY_OTHER_SALES)
  const owner = useSalesOwnerAccess(order.customerId);
  const ownerBlocked = owner.blockedReason;
  const today = toLocalIsoDate(new Date().toISOString());
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
        onSuccess: () => {
          setConfirmCreate(false);
          setReviewFirst(true);
        },
        onError: (error) => {
          setConfirmCreate(false);
          // Khách chưa có hồ sơ pháp lý: không chỉ toast, dẫn Sale tới nơi nhập (không import `features/customer`).
          if (error instanceof ApiError && error.code === "CUSTOMER_LEGAL_PROFILE_MISSING")
            setLegalMissing(contractErrorMessage(error));
          else toast.error(contractErrorMessage(error, owner.ownerName));
          if (isSalesOwnerError(error)) owner.refresh();
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
          <div className="flex flex-wrap items-center gap-3">
            {contract && (
              <StatusDot
                domain="order"
                status={SALES_CONTRACT_STATUS_TONE_KEY[contract.status]}
                label={SALES_CONTRACT_STATUS_LABELS[contract.status]}
              />
            )}
            {contract && <ContractEsignBadges contract={contract} />}
            {/* bo-18 / bo-20: MỘT chỗ mở lịch sử, trên đầu khối — không dính vào nút "Lập hợp đồng". */}
            {query.isSuccess && (
              <button
                type="button"
                className="text-accent-text text-xs hover:underline"
                aria-expanded={showHistory}
                aria-controls="contract-history"
                onClick={() => setShowHistory((v) => !v)}
              >
                {showHistory ? H.hide : H.show}
              </button>
            )}
          </div>
        </div>
        <div id="contract-history">
          {showHistory && <ContractHistory orderId={order.orderId} />}
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
              <div>
                <Button
                  size="sm"
                  disabled={create.isPending || !!ownerBlocked}
                  title={ownerBlocked ?? undefined}
                  aria-describedby={ownerBlocked ? "contract-owner-blocked" : undefined}
                  onClick={() => setConfirmCreate(true)}
                >
                  {contract ? "Lập hợp đồng mới" : "Lập hợp đồng"}
                </Button>
              </div>
            )}
            {/* BR-S12: lý do khi có nút hợp đồng bị tắt vì người phụ trách; người lo thay thấy dòng của mình. */}
            <SalesOwnerAccessNote
              id="contract-owner-blocked"
              access={{
                blockedReason: actions.some(isOwnerGatedContractAction) ? ownerBlocked : null,
                coverNote: owner.coverNote,
              }}
            />
            <ConfirmDialog
              open={confirmCreate}
              onOpenChange={(next) => !next && !create.isPending && setConfirmCreate(false)}
              title={C.title(order.orderNumber)}
              description={C.description}
              confirmLabel={C.confirm}
              cancelLabel={C.cancel}
              variant="default"
              loading={create.isPending}
              closeOnConfirm={false}
              onConfirm={startContract}
            >
              <dl className="border-border-default grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-[var(--r-sm)] border px-3 py-2 text-[0.8125rem]">
                <dt className="text-ink-secondary">{C.total}</dt>
                <dd className="text-ink-primary text-right font-medium tabular-nums">
                  {formatMoney(order.totalAmount, order.currency)}
                </dd>
                <dt className="text-ink-secondary">{C.lines}</dt>
                <dd className="text-ink-primary text-right tabular-nums">{order.lines.length}</dd>
                <dt className="text-ink-secondary">{C.batches}</dt>
                <dd className="text-ink-primary text-right">{C.batchesValue}</dd>
                <dt className="text-ink-secondary">{C.plan}</dt>
                <dd className="text-ink-primary text-right">{C.planValue}</dd>
              </dl>
            </ConfirmDialog>
            {contract && contract.status !== "CANCELLED" && (
              <>
                {reviewFirst && contract.status === "DRAFT" && (
                  <Notice tone="positive" live>
                    {C.created(contract.contractNumber)}
                  </Notice>
                )}
                <ContractCreditReviewNotice
                  contract={contract}
                  canWithdraw={actions.includes("withdraw-review")}
                />
                {contract.status === "DRAFT" &&
                  contract.creditReview !== "PENDING" &&
                  contract.termsReview !== "PENDING" && (
                    <ContractCreditWarning
                      contract={contract}
                      onEdit={
                        actions.includes("edit") && !ownerBlocked
                          ? () => setEditing(true)
                          : undefined
                      }
                      onSend={
                        actions.includes("send") &&
                        !contractTermsNeedApproval(contract) &&
                        !ownerBlocked &&
                        !sendBlockersText(sendBlockers(contract, today))
                          ? () => setDialog("send")
                          : undefined
                      }
                    />
                  )}
                <ContractEsignActions contract={contract} can={can} ownerBlocked={ownerBlocked} />
                <ContractActions
                  contract={contract}
                  actions={actions}
                  onEdit={() => setEditing(true)}
                  onSigned={() => setSigned(true)}
                  dialog={dialog}
                  setDialog={setDialog}
                  papers={contractPapers(contract, order.status)}
                  reviewFirst={reviewFirst}
                  onPreviewed={() => setReviewFirst(false)}
                  owner={owner}
                />
                {editing &&
                contract.status === "DRAFT" &&
                contract.creditReview !== "PENDING" &&
                contract.termsReview !== "PENDING" ? (
                  <ContractEditor
                    contract={contract}
                    order={order}
                    onDone={() => setEditing(false)}
                    onSaved={() => {
                      setEditing(false);
                      setReviewFirst(false);
                      // S06-4: về đầu khối hợp đồng — thấy ngay nút "Gửi hợp đồng" và trạng thái, không phải cuộn tìm.
                      scrollToSection("contract");
                    }}
                  />
                ) : (
                  <ContractSummary
                    contract={contract}
                    installments={installments.data?.installments}
                  />
                )}
                <ContractRevisions orderId={order.orderId} />
                <ContractSignaturePanel orderId={order.orderId} />
              </>
            )}
          </>
        )}
      </section>
    </Card>
  );
}
