"use client";

import { useRef, useState } from "react";

import { UI_LABELS } from "@/constants";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

import type { RefObject } from "react";

const G = UI_LABELS.skuPurchasing.closeGuard;

/** Trạng thái form mua hàng ĐÚNG lúc người dùng đóng panel — đọc đồng bộ, không chờ lần render sau. */
export interface PurchasingCloseState {
  dirty: boolean;
  saving: boolean;
}
export type PurchasingCloseCheck = () => PurchasingCloseState;
/** Form mua hàng (khi đang mở) đăng ký hàm kiểm vào đây; không mở form → null → đóng như thường. */
export type PurchasingCloseGuard = RefObject<PurchasingCloseCheck | null>;

/**
 * Chặn đóng panel biến thể (Esc / bấm nền / nút Đóng của `SlideOverPanel` — cùng một `onClose`) làm mất
 * thông tin mua hàng đang sửa dở: đang lưu → bỏ qua (không ngắt PUT, không hỏi); có thay đổi → hỏi trước;
 * còn lại → đóng ngay. Hộp hỏi đặt TRONG panel để Radix coi là lớp con (Esc / bấm trong hộp không đóng panel).
 */
export function usePurchasingCloseGuard(onClose: () => void) {
  const guard = useRef<PurchasingCloseCheck | null>(null);
  const [asking, setAsking] = useState(false);

  const requestClose = () => {
    const state = guard.current?.();
    if (state?.saving) return;
    if (state?.dirty) {
      setAsking(true);
      return;
    }
    onClose();
  };

  const confirm = (
    <ConfirmDialog
      open={asking}
      onOpenChange={setAsking}
      title={G.title}
      description={G.description}
      confirmLabel={G.discard}
      cancelLabel={G.keepEditing}
      variant="danger"
      onConfirm={() => {
        setAsking(false);
        onClose();
      }}
    />
  );

  return { guard, requestClose, confirm };
}
