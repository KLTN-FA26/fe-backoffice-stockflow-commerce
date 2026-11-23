"use client";

import { useState } from "react";
import { Mail } from "lucide-react";

import { EINVOICE_RESEND_EMAIL_PERMISSION } from "@/constants/einvoice";
import { EINVOICE_LABELS } from "@/constants/labels-einvoice";
import { useCan } from "@/lib/auth/components/Can";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";

import { resendEmailErrorMessage } from "../errors";
import { useResendEInvoiceEmail } from "../mutations";

/**
 * "Gửi lại hoá đơn qua e-mail" (BE `POST /einvoices/{id}/email`, audit r2 einvoice M-1; HĐ-8): hoá đơn phát hành lúc khách
 * chưa có e-mail nhận hoá đơn — Sale ghi e-mail vào hồ sơ pháp lý rồi gửi lại; hoặc thư trước đi tới địa chỉ đã sửa.
 * Thư đi tới e-mail nhận hoá đơn HIỆN TẠI của khách; BE trả địa chỉ đó và màn hiện nó.
 *
 * Dùng ở chi tiết hoá đơn (Kế toán) và trên thông báo "chưa gửi được thư" trong hộp thư của Sale — Sale không có quyền
 * xem hoá đơn (`einvoices`), thông báo là chỗ duy nhất Sale thấy hoá đơn (BE `sourceId`). Quyền
 * `customer-legal-profiles:UPDATE`; không có quyền → không hiện. UI-only — BE kiểm lại.
 */
export function ResendEmailButton({
  einvoiceId,
  invoiceLabel,
  size = "sm",
  confirm: askFirst = true,
}: {
  einvoiceId: string;
  /** Số / mã hoá đơn cho câu xác nhận; vắng (từ thông báo) → "hoá đơn này". */
  invoiceLabel?: string;
  size?: "sm" | "xs";
  /**
   * Hỏi xác nhận trước khi gửi (mặc định). Trên thông báo trong ô thông báo thì không: hộp thoại mở ra ngoài ô sẽ đóng ô
   * (và chính nút) — gửi lại chỉ là một thư tới địa chỉ của khách, lỗi hiện ngay dưới nút.
   */
  confirm?: boolean;
}) {
  const canResend = useCan(EINVOICE_RESEND_EMAIL_PERMISSION);
  const resend = useResendEInvoiceEmail();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  if (!canResend) return null;

  const close = () => {
    setConfirming(false);
    setError(null);
  };
  const confirm = () =>
    resend.mutate(
      { id: einvoiceId },
      {
        onSuccess: (result) => {
          setSentTo(result.recipient ?? "");
          setConfirming(false);
          setError(null);
        },
        onError: (failure) => setError(resendEmailErrorMessage(failure)),
      },
    );

  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={size === "xs" ? "h-7 px-2 text-xs" : undefined}
        disabled={resend.isPending}
        onClick={() => {
          setError(null);
          if (askFirst) setConfirming(true);
          else confirm();
        }}
      >
        <Mail className="size-3.5" aria-hidden="true" /> {EINVOICE_LABELS.actions.resendEmail}
      </Button>
      {error && !confirming && (
        <span role="alert" className="text-danger text-xs">
          {error}
        </span>
      )}
      {sentTo !== null && (
        <span role="status" className="text-ink-secondary text-xs">
          {sentTo ? `Đã yêu cầu gửi tới ${sentTo}.` : "Đã yêu cầu gửi lại."}
        </span>
      )}
      {confirming && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && close()}
          title="Gửi lại hoá đơn qua e-mail?"
          description={`Hệ thống gửi ${invoiceLabel ? `hoá đơn ${invoiceLabel}` : "hoá đơn này"} (kèm PDF và XML) tới e-mail nhận hoá đơn hiện tại trong hồ sơ pháp lý của khách. Mỗi lần bấm là một thư mới.`}
          confirmLabel={EINVOICE_LABELS.actions.resendEmail}
          closeOnConfirm={false}
          loading={resend.isPending}
          error={error}
          onConfirm={confirm}
        />
      )}
    </span>
  );
}
