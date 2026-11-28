"use client";

import { useState } from "react";
import { Check, Eye, EyeOff } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { FieldError, MONO, fieldClass } from "../primitives";

import type { UseFormRegisterReturn } from "react-hook-form";

const S = UI_LABELS.shipping.waybill.carriers.config.secret;

/**
 * Ô khoá / thông tin xác thực CHỈ ĐI VÀO (docs 09 §4.1: không hiển thị lại sau khi lưu). Đã lưu: chỉ hiện "Đã lưu" và nút đổi
 * khoá — không có ô nào chứa giá trị cũ. Bấm "Thay khoá" mới mở ô nhập kiểu mật khẩu, trống; để trống nghĩa là giữ khoá đã lưu
 * (không gửi gì). `mustReplace`: luật khác buộc nhập khoá mới (vd đổi môi trường) nên ô nhập mở sẵn.
 */
export function SecretField({
  id,
  label,
  hint,
  saved,
  replacing,
  mustReplace = false,
  onReplace,
  onKeep,
  registration,
  error,
  maxLength,
}: {
  id: string;
  label: string;
  hint: string;
  saved: boolean;
  replacing: boolean;
  mustReplace?: boolean;
  onReplace: () => void;
  onKeep: () => void;
  registration: UseFormRegisterReturn;
  error?: string;
  maxLength: number;
}) {
  const showInput = !saved || replacing || mustReplace;
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <Label htmlFor={id} className="text-ink-secondary mb-1 block text-xs font-medium">
        {label} {!saved && <span className="text-danger">*</span>}
      </Label>
      {showInput ? (
        <div className="flex items-center gap-2">
          <Input
            id={id}
            type={visible ? "text" : "password"}
            autoComplete="new-password"
            maxLength={maxLength}
            aria-invalid={error ? true : undefined}
            aria-describedby={`${id}-hint`}
            className={`${fieldClass(!!error)} ${MONO}`}
            {...registration}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setVisible((current) => !current)}
            aria-pressed={visible}
            aria-label={visible ? S.hideAria(label) : S.showAria(label)}
            title={visible ? S.hide : S.show}
          >
            {visible ? (
              <EyeOff className="size-4" aria-hidden />
            ) : (
              <Eye className="size-4" aria-hidden />
            )}
          </Button>
          {saved && !mustReplace && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setVisible(false);
                onKeep();
              }}
              aria-label={S.keepAria(label)}
            >
              {S.keep}
            </Button>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2" role="group" aria-label={label}>
          <span className="text-positive inline-flex items-center gap-1 text-[0.8125rem] font-medium">
            <Check className="size-3.5" aria-hidden />
            {S.saved}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onReplace}
            aria-label={S.replaceAria(label)}
          >
            {S.replace}
          </Button>
        </div>
      )}
      <p id={`${id}-hint`} className="text-ink-tertiary mt-1 text-xs">
        {saved && showInput && !mustReplace ? S.replaceHint : hint}
      </p>
      <FieldError>{error}</FieldError>
    </div>
  );
}
