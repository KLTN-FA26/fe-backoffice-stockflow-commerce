"use client";

import { useState } from "react";
import Link from "next/link";
import { FileOutput, LoaderCircle, Pencil, Send, XCircle } from "lucide-react";

import { ADMIN_ROUTES, CUSTOMER_PERMISSIONS, QUOTE_PRICE_REVIEW_LABELS } from "@/constants";
import { useAuthStore } from "@/lib/auth";
import { usePermissionChecker } from "@/lib/auth/components/Can";
import { useCustomerRef } from "@/lib/references/customer-lookup";
import { quoteErrorMessage } from "@/features/quote/errors";
import { allowedStaffQuoteActions } from "@/features/quote/lifecycle";
import { useReviseQuote } from "@/features/quote/mutations";
import {
  canCancelAcceptedQuote,
  isPriceReviewSubmitter,
  sendBlockReason,
} from "@/features/quote/selectors";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DETAIL_ACTION_CLASS } from "@/components/shared/DetailSection";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import { PriceReviewActions } from "../price-review/PriceReviewActions";
import { CancelQuoteDialog } from "./CancelQuoteDialog";
import { ConvertQuoteDialog } from "./ConvertQuoteDialog";
import { QuotePdfButton } from "./QuotePdfButton";
import { SendQuoteDialog } from "./SendQuoteDialog";

import type { Quote } from "@/features/quote/types";

type Dialog = "send" | "cancel" | "revise" | "convert" | null;

/**
 * Nút back-office theo lifecycle (allowedStaffQuoteActions, plan WF-02 A4):
 * DRAFT → Sửa / Gửi khách / Huỷ; CHANGES_REQUESTED → Mở bản sửa; ACCEPTED → Tạo đơn (Huỷ chỉ khi là báo giá cũ — QD-16 —
 * có dòng SKU ngừng bán — BE-14 — hoặc khách không còn ACTIVE — LC-2; trạng thái khách đọc chung query với tên khách, cần
 * `customer-customers:READ`). Báo giá cũ đã chấp nhận chỉ còn nút Huỷ.
 * 14 BR-10: nháp chờ duyệt giá → Rút lại / Duyệt giá / Từ chối (`PriceReviewActions`) và Huỷ; nháp mà gửi bây giờ sẽ
 * phải chờ duyệt (`priceCheck.needsApproval`) → nút ghi "Gửi duyệt giá" thay cho "Gửi khách".
 * Tải PDF luôn có cho người đọc được báo giá. Nút xếp dọc trong thẻ trạng thái cột phải (như thẻ hành động sản phẩm).
 */
export function QuoteStaffActions({ quote }: { quote: Quote }) {
  const can = usePermissionChecker();
  const [dialog, setDialog] = useState<Dialog>(null);
  const revise = useReviseQuote();
  // Cùng query key với <CustomerName> trên trang → không gọi thêm API. Không đọc được khách → chỉ còn luật SKU.
  // UI-only, Backend phải re-check (BE kiểm lại điều kiện huỷ).
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
  const onError = (error: unknown) => toast.error(quoteErrorMessage(error));
  const close = () => setDialog(null);
  const sendBlocked = sendBlockReason(quote);

  return (
    <div className="space-y-2">
      {actions.includes("edit") && (
        <Button asChild size="sm" variant="outline" className={DETAIL_ACTION_CLASS.outline}>
          <Link href={ADMIN_ROUTES.quotes.edit(quote.id)}>
            <Pencil className="size-3.5" /> Sửa
          </Link>
        </Button>
      )}
      {actions.includes("send") && (
        <Button
          type="button"
          size="sm"
          disabled={!!sendBlocked}
          title={sendBlocked ?? undefined}
          onClick={() => setDialog("send")}
          className={DETAIL_ACTION_CLASS.primary}
        >
          <Send className="size-3.5" />{" "}
          {needsApproval ? QUOTE_PRICE_REVIEW_LABELS.action.sendForApproval : "Gửi khách"}
        </Button>
      )}
      {sendBlocked && actions.includes("send") && (
        <p className="text-ink-tertiary text-center text-xs">{sendBlocked}</p>
      )}
      <PriceReviewActions
        quote={quote}
        actions={actions}
        submittedByMe={submittedByMe}
        onError={onError}
      />
      {actions.includes("revise") && (
        <Button
          type="button"
          size="sm"
          disabled={revise.isPending}
          onClick={() => setDialog("revise")}
          className={DETAIL_ACTION_CLASS.primary}
        >
          {revise.isPending && <LoaderCircle className="size-3.5 animate-spin" />} Mở bản sửa
        </Button>
      )}
      {actions.includes("convert") && (
        <Button
          type="button"
          size="sm"
          onClick={() => setDialog("convert")}
          className={DETAIL_ACTION_CLASS.primary}
        >
          <FileOutput className="size-3.5" /> Tạo đơn
        </Button>
      )}
      <QuotePdfButton quote={quote} onError={onError} className={DETAIL_ACTION_CLASS.outline} />
      {actions.includes("cancel") && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className={DETAIL_ACTION_CLASS.danger}
          onClick={() => setDialog("cancel")}
        >
          <XCircle className="size-3.5" />
          {quote.status === "ACCEPTED" ? "Huỷ báo giá đã chấp nhận" : "Huỷ báo giá"}
        </Button>
      )}

      <SendQuoteDialog quote={quote} open={dialog === "send"} onClose={close} onError={onError} />
      <ConfirmDialog
        open={dialog === "revise"}
        onOpenChange={(open) => !open && close()}
        title="Mở bản sửa?"
        description="Báo giá trở về nháp (bản mới) để Sales điều chỉnh theo góp ý của khách, rồi gửi lại."
        confirmLabel="Mở bản sửa"
        variant="default"
        loading={revise.isPending}
        closeOnConfirm={false}
        onConfirm={() =>
          revise.mutate({ id: quote.id, version: quote.version }, { onSuccess: close, onError })
        }
      />
      <CancelQuoteDialog
        quote={quote}
        open={dialog === "cancel"}
        onClose={close}
        onError={onError}
      />
      <ConvertQuoteDialog
        quote={quote}
        open={dialog === "convert"}
        onOpenChange={(open) => !open && close()}
      />
    </div>
  );
}
