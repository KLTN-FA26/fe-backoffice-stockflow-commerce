"use client";

import { useRef } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";

import { DELIVERY_MODE, UI_LABELS } from "@/constants";
import { transferFormSchema } from "@/features/transfer/input-schemas";
import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/ui/button";

import { Section } from "../primitives";
import { clearLineErrors, removeLineErrors } from "./server-line-errors";
import { TransferHeaderFields } from "./TransferHeaderFields";
import { TransferLineRows } from "./TransferLineRows";
import { useServerErrors } from "./use-server-errors";

import type { TransferFormInput, TransferFormValues } from "@/features/transfer/types";

export const EMPTY_TRANSFER_FORM: TransferFormInput = {
  fromWarehouseId: "",
  toWarehouseId: "",
  reason: "",
  expectedDate: "",
  deliveryMode: DELIVERY_MODE.FULL_TRUCKLOAD,
  lines: [{ sku: "", lotNumber: "", quantity: 1 }],
};

interface TransferFormProps {
  defaultValues: TransferFormInput;
  submitLabel: string;
  cancelHref: string;
  isPending: boolean;
  /** Gọi mutation; reject bằng lỗi BE để form map về ô / thông báo chung. */
  onSubmit: (values: TransferFormValues) => Promise<unknown>;
}

/**
 * Form lệnh chuyển kho — dùng chung tạo mới (`POST`) và sửa nháp (`PUT`). zod chặn sớm (BR-01,
 * trùng SKU + lô, giới hạn BE); lỗi BE (thiếu tồn, kho ngừng hoạt động…) hiện ở đầu form,
 * `fieldErrors` của `@Valid` map về đúng dòng.
 */
export function TransferForm({
  defaultValues,
  submitLabel,
  cancelHref,
  isPending,
  onSubmit,
}: TransferFormProps) {
  const form = useForm<TransferFormInput, unknown, TransferFormValues>({
    resolver: zodResolver(transferFormSchema),
    mode: "onTouched",
    defaultValues,
  });
  // Tách từng phần (không giữ cả object): object chứa ref → React Compiler coi mọi field là ref
  const { serverError, serverLineErrors, setServerLineErrors, errorRef, clear, fail } =
    useServerErrors(form);

  // Chặn gửi trùng: zodResolver chạy async nên `isPending` bật trễ hơn cú click / Enter thứ hai
  const inFlight = useRef(false);
  const onValid = async (values: TransferFormValues) => {
    if (inFlight.current) return;
    inFlight.current = true;
    clear();
    try {
      await onSubmit(values);
    } catch (error: unknown) {
      fail(error, values.lines);
    } finally {
      inFlight.current = false;
    }
  };
  const busy = isPending || form.formState.isSubmitting;

  return (
    <form
      // Lỗi kiểm tra phía FE ở lần bấm sau → bỏ lỗi máy chủ cũ (không còn đúng với dữ liệu mới)
      onSubmit={(event) => void form.handleSubmit(onValid, clear)(event)}
      noValidate
      className="space-y-5"
    >
      {/* Vùng live luôn có trong DOM (để đọc khi lỗi xuất hiện); rỗng thì bù khoảng cách của space-y */}
      <div ref={errorRef} role="alert" className="empty:-mb-5">
        {serverError && <Alert tone="danger">{serverError}</Alert>}
      </div>
      {/* Đang lưu → khoá cả form: sửa / xoá dòng giữa chừng làm lỗi trả về gắn nhầm dòng */}
      <fieldset disabled={busy} className="min-w-0 space-y-5">
        <Section title={UI_LABELS.transfer.sectionInfo}>
          <TransferHeaderFields form={form} />
        </Section>
        <Section title={UI_LABELS.transfer.sectionLines}>
          <TransferLineRows
            form={form}
            serverLineErrors={serverLineErrors}
            onLineEdited={(index) => setServerLineErrors((prev) => clearLineErrors(prev, index))}
            onLineRemoved={(index) => setServerLineErrors((prev) => removeLineErrors(prev, index))}
          />
        </Section>
      </fieldset>
      <div className="flex justify-end gap-2">
        {/* Đang lưu → khoá "Quay lại": rời trang giữa chừng rồi bị kéo sang chi tiết khi lưu xong */}
        <Button
          variant="outline"
          size="sm"
          asChild
          className={`h-(--action-h) rounded-(--action-radius) px-(--action-px) ${busy ? "pointer-events-none opacity-50" : ""}`}
        >
          <Link href={cancelHref} aria-disabled={busy} tabIndex={busy ? -1 : undefined}>
            {UI_LABELS.common.back}
          </Link>
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={busy}
          className="bg-brand text-ink-inverse hover:bg-brand-hover h-(--action-h) rounded-(--action-radius) px-(--action-px)"
        >
          {busy && <Loader2 className="size-3.5 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
