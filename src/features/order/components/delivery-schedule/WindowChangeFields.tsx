"use client";

import { Controller } from "react-hook-form";

import {
  ORDER_LIMITS,
  WINDOW_CHANGE_LABELS as L,
  WINDOW_CHANGE_REASONS,
  WINDOW_CHANGE_REASON_LABELS,
} from "@/constants";
import { DatePicker } from "@/components/shared/DatePicker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { FormFieldError, RequiredMark } from "../FormFieldError";

import { WindowEvidenceField } from "./WindowEvidenceField";

import type { Control, FieldErrors, UseFormRegister } from "react-hook-form";
import type { WindowChangeFormInput } from "../../delivery-window-schemas";

const LABEL = "text-ink-secondary text-xs font-medium";

interface WindowChangeFieldsProps {
  control: Control<WindowChangeFormInput>;
  register: UseFormRegister<WindowChangeFormInput>;
  errors: FieldErrors<WindowChangeFormInput>;
  /** Hôm nay `YYYY-MM-DD` (Asia/Ho_Chi_Minh) — ngày sớm nhất chọn được (BR-28). */
  today: string;
  /** Hai đầu đang chọn — cận dưới của ô "Đến ngày" và để báo lỗi chéo ô ngay khi lệch. */
  windowStart: string;
  windowEnd: string;
  idPrefix: string;
}

/** Ô của form dời cửa sổ giao: cửa sổ mới, mã lý do, ghi chú, bằng chứng khách đồng ý. */
export function WindowChangeFields({
  control,
  register,
  errors,
  today,
  windowStart,
  windowEnd,
  idPrefix,
}: WindowChangeFieldsProps) {
  const id = (name: string) => `${idPrefix}-${name}`;
  // Luật chéo ô (BR-28) hiện ngay khi lệch, không đợi các ô khác hợp lệ mới kiểm
  const endError =
    errors.windowEnd?.message ??
    (windowStart && windowEnd && windowEnd < windowStart ? L.endBeforeStart : undefined);
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor={id("start")} className={LABEL}>
            {L.startLabel} <RequiredMark />
          </Label>
          <Controller
            control={control}
            name="windowStart"
            render={({ field }) => (
              <DatePicker
                id={id("start")}
                value={field.value}
                onChange={field.onChange}
                min={today}
                aria-invalid={errors.windowStart ? true : undefined}
                aria-describedby={errors.windowStart ? id("start-error") : undefined}
              />
            )}
          />
          <FormFieldError id={id("start-error")} message={errors.windowStart?.message} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={id("end")} className={LABEL}>
            {L.endLabel} <RequiredMark />
          </Label>
          <Controller
            control={control}
            name="windowEnd"
            render={({ field }) => (
              <DatePicker
                id={id("end")}
                value={field.value}
                onChange={field.onChange}
                min={windowStart || today}
                aria-invalid={endError ? true : undefined}
                aria-describedby={endError ? id("end-error") : undefined}
              />
            )}
          />
          <FormFieldError id={id("end-error")} message={endError} />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={id("reason")} className={LABEL}>
          {L.reasonLabel} <RequiredMark />
        </Label>
        <Controller
          control={control}
          name="reasonCode"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger
                id={id("reason")}
                aria-required="true"
                aria-invalid={errors.reasonCode ? true : undefined}
                className="w-full"
              >
                <SelectValue placeholder={L.reasonPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {WINDOW_CHANGE_REASONS.map((code) => (
                  <SelectItem key={code} value={code}>
                    {WINDOW_CHANGE_REASON_LABELS[code]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FormFieldError id={id("reason-error")} message={errors.reasonCode?.message} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={id("note")} className={LABEL}>
          {L.noteLabel} <RequiredMark />
        </Label>
        <Textarea
          id={id("note")}
          rows={3}
          maxLength={ORDER_LIMITS.windowChangeNoteMax}
          placeholder={L.notePlaceholder}
          aria-required="true"
          aria-invalid={errors.note ? true : undefined}
          aria-describedby={errors.note ? id("note-error") : undefined}
          {...register("note")}
        />
        <FormFieldError id={id("note-error")} message={errors.note?.message} />
      </div>
      <WindowEvidenceField
        register={register}
        error={errors.evidenceMessageId?.message}
        idPrefix={idPrefix}
      />
    </>
  );
}
