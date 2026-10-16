"use client";

import { RECEIPT_LIMITS } from "@/constants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { FieldError, Section } from "../primitives";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { ReceiptCreateInput } from "@/features/receipt/types";

const FIELD = "border-border-default bg-bg-surface mt-1 rounded-[var(--r-sm)] text-[0.8125rem]";

/** Phiếu giao NCC + ghi chú (BE CreateGoodsReceiptRequest: deliveryNote ≤ 100, note ≤ 2000). */
export function DeliveryNoteFields({
  register,
  errors,
}: {
  register: UseFormRegister<ReceiptCreateInput>;
  errors: FieldErrors<ReceiptCreateInput>;
}) {
  return (
    <Section
      title="Phiếu giao của nhà cung cấp"
      description="Khuyến nghị nhập để đối chiếu với xe hàng (docs 03 bước 2)."
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="receipt-delivery-note" className="text-[0.8125rem]">
            Số phiếu giao
          </Label>
          <Input
            id="receipt-delivery-note"
            maxLength={RECEIPT_LIMITS.deliveryNoteMax}
            className={FIELD}
            {...register("deliveryNote")}
          />
          <FieldError>{errors.deliveryNote?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="receipt-note" className="text-[0.8125rem]">
            Ghi chú
          </Label>
          <Textarea
            id="receipt-note"
            rows={2}
            maxLength={RECEIPT_LIMITS.noteMax}
            className={FIELD}
            {...register("note")}
          />
          <FieldError>{errors.note?.message}</FieldError>
        </div>
      </div>
    </Section>
  );
}
