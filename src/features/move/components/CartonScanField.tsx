"use client";

import { useRef } from "react";
import { cn } from "cn";
import { ScanLine } from "lucide-react";

import { MOVE_LABELS } from "@/constants/move";

import { useScanInput } from "@/hooks/use-scan-input";

import { FORM_INPUT_CLASS } from "@/components/shared/form-control-classes";
import { Notice } from "@/components/shared/Notice";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { ScanFeedback } from "../use-carton-scan";

/**
 * Ô quét LPN (mode-a §4.3, docs 11 §4.1 bước 1): luôn focus, Enter thêm thùng, Esc xoá ô. Kết quả của lần quét gần nhất
 * hiện ngay dưới ô — thùng bị từ chối báo đỏ kèm lý do.
 */
export function CartonScanField({
  onScan,
  disabled,
  pending,
  feedback,
}: {
  onScan: (lpn: string) => void;
  disabled: boolean;
  pending: boolean;
  feedback: ScanFeedback | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const input = useScanInput(inputRef, { onScan, disabled: disabled || pending });
  return (
    <div className="space-y-1.5">
      <Label htmlFor="move-scan" className="flex items-center gap-1.5">
        <ScanLine className="text-accent size-3.5" aria-hidden />
        {MOVE_LABELS.scan}
      </Label>
      <Input
        ref={inputRef}
        id="move-scan"
        className={cn(FORM_INPUT_CLASS, "font-mono")}
        value={input.value}
        onChange={input.onChange}
        onBlur={input.onBlur}
        onKeyDown={input.onKeyDown}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        aria-describedby="move-scan-help"
      />
      <p id="move-scan-help" className="text-ink-secondary text-sm">
        {pending ? MOVE_LABELS.scanning : MOVE_LABELS.scanHelp}
      </p>
      {feedback && (
        <Notice tone={feedback.tone} live>
          {feedback.text}
        </Notice>
      )}
    </div>
  );
}
