"use client";

import { useState } from "react";
import { Pencil, Undo2, XCircle } from "lucide-react";
import { parseAsBoolean, useQueryState } from "nuqs";

import {
  ADMIN_ROUTES,
  CUSTOMER_PERMISSIONS,
  QUOTE_PRICE_APPROVAL_PERMISSIONS,
  QUOTE_PRICE_REVIEW_LABELS,
} from "@/constants";
import { useAuthStore } from "@/lib/auth";
import { usePermissionChecker } from "@/lib/auth/components/Can";
import { useCustomerRef } from "@/lib/references/customer-lookup";
import { useSalesOwnerAccess } from "@/lib/references/sales-owner-queries";
import { isSalesOwnerError } from "@/lib/references/sales-owner-access";
import { quoteErrorMessage } from "@/features/quote/errors";
import { allowedStaffQuoteActions, isOwnerGatedQuoteAction } from "@/features/quote/lifecycle";
import { useReviseQuote } from "@/features/quote/mutations";
import {
  canCancelAcceptedQuote,
  isPriceReviewSubmitter,
  sendBlockReason,
} from "@/features/quote/selectors";
import { SalesOwnerAccessNote } from "@/components/backoffice/SalesOwnerNotes";
import { ActionTrigger, ObjectActions } from "@/components/shared/ObjectActions";
import { toast } from "@/components/shared/Toast";

import { QUOTE_SEND_PARAM } from "../form/useQuoteForm";
import { QuoteActionDialogs } from "./QuoteActionDialogs";
import { quoteActionTrigger } from "./quote-action-triggers";
import { QuotePdfButton } from "./QuotePdfButton";

import type { StaffQuoteAction } from "@/features/quote/lifecycle";
import type { Quote } from "@/features/quote/types";
import type { PriceReviewDialog } from "../price-review/PriceReviewDialogs";

import type { QuoteDialog as Dialog } from "./QuoteActionDialogs";

/**
 * Nút back-office theo lifecycle (allowedStaffQuoteActions, plan WF-02 A4):
 * DRAFT → Sửa / Gửi khách / Huỷ; CHANGES_REQUESTED → Mở bản sửa; ACCEPTED → Tạo đơn (Huỷ chỉ khi là báo giá cũ — QD-16 —
 * có dòng SKU ngừng bán — BE-14 — hoặc khách không còn ACTIVE — LC-2; trạng thái khách tra một lần trên trang chi tiết, cần
 * `customer-customers:READ`). Báo giá cũ đã chấp nhận chỉ còn nút Huỷ.
 * 14 BR-10: nháp chờ duyệt giá → Rút lại / Duyệt giá / Từ chối (`PriceReviewActions`) và Huỷ; nháp mà gửi bây giờ sẽ
 * phải chờ duyệt (`priceCheck.needsApproval`) → nút ghi "Gửi duyệt giá" thay cho "Gửi khách".
 * Tải PDF luôn có cho người đọc được báo giá (trong menu "⋯"). Bốn mắt: người gửi duyệt mà có quyền duyệt thấy câu giải
 * thích thay cho nút duyệt.
 * BR-S12 (chế độ chặt): khách có người phụ trách khác → Sửa / Gửi / Mở bản sửa / Huỷ / Rút duyệt giá vẫn hiện nhưng tắt, lý
 * do ở chú thích và dòng dưới nút; người lo thay thấy "Bạn đang lo thay cho …". Duyệt giá, tạo đơn không bị chặn.
 */
export function QuoteStaffActions({ quote }: { quote: Quote }) {
  const can = usePermissionChecker();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [review, setReview] = useState<PriceReviewDialog>(null);
  const revise = useReviseQuote();
  // Trạng thái khách (LC-2) BE không kèm trong báo giá (#286 chỉ thêm tên / mã) → vẫn tra một lần, chỉ khi ACCEPTED, trên
  // trang chi tiết (không phải mỗi dòng). Cùng query key với <CustomerName> khi nó phải tra (BE thiếu tên) → không gọi
  // trùng. Không đọc được khách → chỉ còn luật SKU. UI-only, Backend phải re-check (BE kiểm lại điều kiện huỷ).
  const customer = useCustomerRef(
    quote.customerId,
    quote.status === "ACCEPTED" && can(CUSTOMER_PERMISSIONS.read),
  );
  const meId = useAuthStore((state) => state.user?.userId ?? null);
  const submittedByMe = isPriceReviewSubmitter(quote, meId);
  const actions = allowedStaffQuoteActions(
    quote.status,
    can,
    quote.legacy,
    canCancelAcceptedQuote(quote, customer.data?.status),
    { pending: quote.priceReviewPending, submittedByMe },
  );
  const needsApproval = quote.priceCheck?.needsApproval ?? false;
  // BR-S12 — UI-only, Backend phải re-check (409 CUSTOMER_OWNED_BY_OTHER_SALES)
  const owner = useSalesOwnerAccess(quote.customerId);
  const ownerBlocked = owner.blockedReason;
  const gated = (action: StaffQuoteAction) => !!ownerBlocked && isOwnerGatedQuoteAction(action);
  const onError = (error: unknown) => {
    toast.error(quoteErrorMessage(error, owner.ownerName));
    if (isSalesOwnerError(error)) owner.refresh();
  };
  const sendBlocked = sendBlockReason(quote);
  // "Lưu và gửi" trên form mở trang này với `?send=true`: mở sẵn hộp xác nhận gửi (Sale vẫn bấm xác nhận) khi gửi được;
  // chưa gửi được thì lý do hiện dưới nút như thường. Đóng hộp thì bỏ tham số để tải lại trang không mở lại.
  const [sendRequested, setSendRequested] = useQueryState(QUOTE_SEND_PARAM, parseAsBoolean);
  const requested =
    sendRequested && actions.includes("send") && !sendBlocked && !ownerBlocked ? "send" : null;
  const openDialog = dialog ?? requested;
  const close = () => {
    setDialog(null);
    if (sendRequested) void setSendRequested(null);
  };

  const selfReview =
    quote.priceReviewPending && submittedByMe && can(QUOTE_PRICE_APPROVAL_PERMISSIONS.approve);
  const sendLabel = needsApproval ? QUOTE_PRICE_REVIEW_LABELS.action.sendForApproval : "Gửi khách";

  // MỘT nút chính theo việc tiếp theo của trạng thái (duyệt giá → gửi → mở bản sửa → tạo đơn); còn lại vào "⋯"
  const primary = (["approvePrice", "send", "revise", "convert"] as const).find((a) =>
    actions.includes(a),
  );
  const show = (action: StaffQuoteAction) => actions.includes(action) && action !== primary;
  const trigger = (action: StaffQuoteAction) =>
    quoteActionTrigger(action, {
      sendLabel,
      sendBlocked,
      ownerBlocked,
      revising: revise.isPending,
      openDialog: setDialog,
      openReview: setReview,
    });

  return (
    // Header đối tượng (backoffice-erp-ui B10): một nút chính nền đậm + menu "⋯" (việc huỷ / từ chối chữ đỏ, cuối menu)
    <div className="flex flex-col items-stretch gap-1.5 lg:items-end">
      <ObjectActions
        menuLabel="Thao tác khác với báo giá"
        hasMenu
        primary={primary ? trigger(primary) : undefined}
      >
        {show("edit") && (
          <ActionTrigger
            icon={Pencil}
            label="Sửa"
            href={ADMIN_ROUTES.quotes.edit(quote.id)}
            disabled={gated("edit")}
            title={gated("edit") ? (ownerBlocked ?? undefined) : undefined}
          />
        )}
        {show("send") && trigger("send")}
        {show("revise") && trigger("revise")}
        {show("convert") && trigger("convert")}
        {show("approvePrice") && trigger("approvePrice")}
        {show("withdrawPriceReview") && (
          <ActionTrigger
            icon={Undo2}
            label={QUOTE_PRICE_REVIEW_LABELS.action.withdraw}
            disabled={gated("withdrawPriceReview")}
            title={gated("withdrawPriceReview") ? (ownerBlocked ?? undefined) : undefined}
            onClick={() => setReview("withdrawPriceReview")}
          />
        )}
        <QuotePdfButton quote={quote} onError={onError} />
        {show("rejectPrice") && (
          <ActionTrigger
            icon={XCircle}
            label={QUOTE_PRICE_REVIEW_LABELS.action.reject}
            danger
            onClick={() => setReview("rejectPrice")}
          />
        )}
        {show("cancel") && (
          <ActionTrigger
            icon={XCircle}
            label={quote.status === "ACCEPTED" ? "Huỷ báo giá đã chấp nhận" : "Huỷ báo giá"}
            danger
            disabled={gated("cancel")}
            title={gated("cancel") ? (ownerBlocked ?? undefined) : undefined}
            onClick={() => setDialog("cancel")}
          />
        )}
      </ObjectActions>
      {/* BR-S12: lý do tắt chỉ khi có nút bị tắt vì người phụ trách; người lo thay luôn thấy dòng của mình. */}
      <SalesOwnerAccessNote
        access={{
          blockedReason: actions.some(isOwnerGatedQuoteAction) ? ownerBlocked : null,
          coverNote: owner.coverNote,
        }}
        className="lg:[&>p]:justify-end"
      />
      {sendBlocked && !ownerBlocked && actions.includes("send") && (
        <p className="text-ink-tertiary text-xs lg:text-right">{sendBlocked}</p>
      )}
      {selfReview && (
        <p className="text-ink-tertiary text-xs lg:text-right">
          {QUOTE_PRICE_REVIEW_LABELS.notice.self}
        </p>
      )}

      <QuoteActionDialogs
        quote={quote}
        dialog={openDialog}
        review={review}
        revise={revise}
        onClose={close}
        onCloseReview={() => setReview(null)}
        onError={onError}
      />
    </div>
  );
}
