"use client";

import { Copy } from "lucide-react";
import { useState } from "react";

import { FormDialog, FormDialogBody } from "@/components/shared/FormDialog";
import { Button } from "@/components/ui/button";

interface TemporaryPasswordDialogProps {
  /** Mật khẩu tạm BE vừa sinh; `null` = đóng. Chỉ giữ trong state của màn, không lưu đâu khác. */
  password: string | null;
  /** Tên tài khoản được cấp mật khẩu. */
  accountLabel: string;
  /** Ngữ cảnh: tạo mới hay đặt lại — chỉ đổi câu mô tả. */
  reason: "created" | "reset";
  /** Số phiên đã bị đăng xuất khi đặt lại (BE `sessionsEnded`). */
  sessionsEnded?: number;
  onClose: () => void;
}

/**
 * Mật khẩu tạm hiện đúng MỘT lần (BE không lưu dạng rõ). Đóng hộp thoại là mất; người dùng đăng nhập
 * bằng mật khẩu này sẽ bị buộc đổi ngay (`mustChangePassword`).
 */
export function TemporaryPasswordDialog({
  password,
  accountLabel,
  reason,
  sessionsEnded,
  onClose,
}: TemporaryPasswordDialogProps) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <FormDialog open={password !== null} onOpenChange={(open) => !open && onClose()}>
      <FormDialogBody
        title="Mật khẩu tạm thời"
        description={
          reason === "created"
            ? `Đã tạo tài khoản ${accountLabel}. Hãy chuyển mật khẩu này cho người dùng — hệ thống sẽ không hiển thị lại.`
            : `Đã đặt lại mật khẩu của ${accountLabel}${sessionsEnded ? ` và đăng xuất ${sessionsEnded} phiên đang mở` : ""}. Hãy chuyển mật khẩu này cho người dùng — hệ thống sẽ không hiển thị lại.`
        }
        submitLabel="Đã lưu lại, đóng"
        canSubmit
        isPending={false}
        error={null}
        hideCancel
        onSubmit={onClose}
        onCancel={onClose}
      >
        <div className="border-border-default bg-bg-subtle flex items-center justify-between gap-3 rounded-[var(--r-sm)] border px-3 py-2">
          <code
            aria-label="Mật khẩu tạm thời"
            className="text-ink-primary font-mono text-[0.9375rem] break-all select-all"
          >
            {password}
          </code>
          <Button type="button" variant="outline" size="sm" onClick={() => void copy()}>
            <Copy className="size-3.5" /> {copied ? "Đã chép" : "Chép"}
          </Button>
        </div>
        <p className="text-ink-secondary text-xs">Người dùng nên đổi mật khẩu sau khi đăng nhập.</p>
      </FormDialogBody>
    </FormDialog>
  );
}
