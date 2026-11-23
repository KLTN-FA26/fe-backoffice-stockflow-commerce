"use client";

import { RETURN_STATUS_BY_API, RMA_PERMISSIONS } from "@/constants/returns";
import { useCan } from "@/lib/auth/components/Can";
import { statusLabelVi } from "@/lib/status-map";
import { FormField } from "@/components/shared/FormField";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useOrderReturnChoices } from "../queries";

const statusText = (status: string) => {
  const display = RETURN_STATUS_BY_API[status as keyof typeof RETURN_STATUS_BY_API] ?? status;
  return statusLabelVi(display, "rma") ?? status;
};

/**
 * Chọn yêu cầu trả hàng của đơn cho điều chỉnh / hoá đơn giảm vì trả hàng (WF-05 HĐ-4, HĐ-5). BE nhận `returnRequestId`
 * là UUID và chỉ nhận yêu cầu thuộc đơn của hoá đơn (`EInvoiceCorrections.requireReturnOf`) — ô gõ tay số RMA luôn bị
 * 400, nên chỉ cho chọn trong danh sách của chính đơn đó và gửi `id`.
 */
export function ReturnRequestPicker({
  id,
  orderId,
  value,
  onChange,
  error,
}: {
  id: string;
  orderId: string;
  value: string;
  onChange: (returnRequestId: string) => void;
  error?: string;
}) {
  const canRead = useCan(RMA_PERMISSIONS.read);
  const choices = useOrderReturnChoices(orderId, canRead);
  const items = choices.data ?? [];
  const hint = !canRead
    ? "Cần quyền xem yêu cầu trả hàng để chọn."
    : choices.isError
      ? "Không tải được các yêu cầu trả hàng của đơn."
      : choices.isSuccess && items.length === 0
        ? "Đơn này chưa có yêu cầu trả hàng."
        : undefined;
  return (
    <FormField id={id} label="Yêu cầu trả hàng" required error={error} hint={hint}>
      <Select value={value} onValueChange={onChange} disabled={!canRead || items.length === 0}>
        <SelectTrigger id={id} aria-invalid={error ? true : undefined}>
          <SelectValue placeholder={choices.isLoading ? "Đang tải…" : "Chọn yêu cầu trả hàng"} />
        </SelectTrigger>
        <SelectContent>
          {items.map((choice) => (
            <SelectItem key={choice.id} value={choice.id}>
              {choice.rmaNumber} · {statusText(choice.status)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}
