"use client";

import { WINDOW_CHANGE_LABELS as L } from "@/constants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { FormFieldError, RequiredMark } from "../FormFieldError";

import type { UseFormRegister } from "react-hook-form";
import type { WindowChangeFormInput } from "../../delivery-window-schemas";

/**
 * Bằng chứng khách đồng ý (docs 17 BR-28): mã tin nhắn chat do CHÍNH khách gửi trong cuộc chat của khách (đơn này hoặc
 * chưa gắn đơn). BE chưa có endpoint liệt kê tin nhắn chat nên chưa có ô chọn tin nhắn — người dùng dán mã; BE kiểm lại
 * (400 VALIDATION_FAILED nếu tin của nhân viên / của khách khác / của đơn khác).
 */
export function WindowEvidenceField({
  register,
  error,
  idPrefix,
}: {
  register: UseFormRegister<WindowChangeFormInput>;
  error: string | undefined;
  idPrefix: string;
}) {
  const LABEL = "text-ink-secondary text-xs font-medium";
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id("evidence")} className={LABEL}>
        {L.evidenceMessageLabel} <RequiredMark />
      </Label>
      <Input
        id={id("evidence")}
        type="text"
        autoComplete="off"
        placeholder={L.evidenceMessagePlaceholder}
        aria-required="true"
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id("evidence-hint")}${error ? ` ${id("evidence-error")}` : ""}`}
        className="font-[family-name:var(--font-mono)] text-[0.8125rem]"
        {...register("evidenceMessageId")}
      />
      <p id={id("evidence-hint")} className="text-ink-tertiary text-xs">
        {L.evidenceMessageHint}
      </p>
      <FormFieldError id={id("evidence-error")} message={error} />
    </div>
  );
}
