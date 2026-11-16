"use client";

import { WINDOW_CHANGE_LABELS as L } from "@/constants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { FormFieldError, RequiredMark } from "../FormFieldError";

import { WindowEvidenceFile } from "./WindowEvidenceFile";

import type { UseFormRegister } from "react-hook-form";
import type { WindowChangeFormInput } from "../../delivery-window-schemas";
import type { EvidenceUpload } from "./useEvidenceUpload";

type Kind = WindowChangeFormInput["evidenceKind"];

interface WindowEvidenceFieldProps {
  kind: Kind;
  onKindChange: (kind: Kind) => void;
  register: UseFormRegister<WindowChangeFormInput>;
  upload: EvidenceUpload;
  /** Lỗi ô mã tin nhắn (UUID sai / thiếu). */
  messageError: string | undefined;
  idPrefix: string;
}

const KINDS: readonly { kind: Kind; label: string }[] = [
  { kind: "file", label: L.evidenceKindFile },
  { kind: "message", label: L.evidenceKindMessage },
];

/**
 * Bằng chứng khách đồng ý (docs 17 BR-28): ĐÚNG MỘT trong hai — tệp (email, văn bản xác nhận; tải thẳng lên kho) hoặc
 * mã tin nhắn chat do CHÍNH khách gửi trong cuộc chat của khách (đơn này hoặc chưa gắn đơn). BE chưa có endpoint liệt kê
 * tin nhắn nên ô tin nhắn nhận mã dán vào; BE kiểm lại (400 nếu tin của nhân viên / khách khác / đơn khác).
 */
export function WindowEvidenceField({
  kind,
  onKindChange,
  register,
  upload,
  messageError,
  idPrefix,
}: WindowEvidenceFieldProps) {
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <fieldset className="border-border-default space-y-3 rounded-[var(--r-sm)] border p-3">
      <legend className="text-ink-secondary px-1 text-xs font-medium">
        {L.evidenceLabel} <RequiredMark />
      </legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {KINDS.map((option) => (
          <label key={option.kind} className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name={id("kind")}
              checked={kind === option.kind}
              onChange={() => onKindChange(option.kind)}
              className="accent-brand"
            />
            <span className="text-ink-primary text-[0.8125rem]">{option.label}</span>
          </label>
        ))}
      </div>
      {kind === "file" ? (
        <>
          <WindowEvidenceFile upload={upload} inputId={id("file")} describedBy={id("file-hint")} />
          <p id={id("file-hint")} className="text-ink-tertiary text-xs">
            {L.file.hint}
          </p>
        </>
      ) : (
        <div className="grid gap-1.5">
          <Label htmlFor={id("evidence")} className="text-ink-secondary text-xs font-medium">
            {L.evidenceMessageLabel}
          </Label>
          <Input
            id={id("evidence")}
            type="text"
            autoComplete="off"
            placeholder={L.evidenceMessagePlaceholder}
            aria-required="true"
            aria-invalid={messageError ? true : undefined}
            aria-describedby={`${id("evidence-hint")}${messageError ? ` ${id("evidence-error")}` : ""}`}
            className="font-[family-name:var(--font-mono)] text-[0.8125rem]"
            {...register("evidenceMessageId")}
          />
          <p id={id("evidence-hint")} className="text-ink-tertiary text-xs">
            {L.evidenceMessageHint}
          </p>
          <FormFieldError id={id("evidence-error")} message={messageError} />
        </div>
      )}
    </fieldset>
  );
}
