"use client";

import { Controller } from "react-hook-form";

import { PICK_LINE_LABELS, SHORT_PICK_REASONS } from "@/constants";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shared/combobox-select";

import { FieldError } from "../primitives";

import type { Control } from "react-hook-form";
import type { ShortPickFormValues } from "@/features/fulfillment/types";

const L = PICK_LINE_LABELS;

/** Lý do báo thiếu thùng: không thấy thùng ở vị trí, hoặc thùng hư hỏng (BE `ShortPickReason`, docs 07 §4.4 bước 9). */
export function ShortPickReasonField({
  control,
  error,
  onPicked,
}: {
  control: Control<ShortPickFormValues>;
  error?: string;
  onPicked: () => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor="short-reason" className="text-ink-primary text-[0.8125rem] font-medium">
        {L.shortReason}
      </Label>
      <Controller
        control={control}
        name="reason"
        render={({ field }) => (
          <Select
            value={field.value ?? ""}
            onValueChange={(value) => {
              field.onChange(value);
              onPicked();
            }}
          >
            <SelectTrigger
              id="short-reason"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "short-reason-error" : "short-reason-hint"}
              className="border-border-default bg-bg-surface text-ink-primary w-full rounded-[var(--r-sm)] text-[0.8125rem]"
            >
              <SelectValue placeholder={L.shortReasonPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {SHORT_PICK_REASONS.map((reason) => (
                <SelectItem key={reason} value={reason}>
                  {L.shortReasons[reason]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      {error ? (
        <FieldError id="short-reason-error">{error}</FieldError>
      ) : (
        <p id="short-reason-hint" className="text-ink-tertiary text-xs">
          {L.shortHint}
        </p>
      )}
    </div>
  );
}
