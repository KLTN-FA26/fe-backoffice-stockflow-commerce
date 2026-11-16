"use client";

import { useEffect, useRef, useState } from "react";

import { UI_LABELS } from "@/constants";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

import type { MouseEvent, RefObject } from "react";

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
 * Link rời panel (`onLeaveLinkClick`) đi qua cùng hộp hỏi: điều hướng cũng làm mất bản nháp.
 */
export function usePurchasingCloseGuard(onClose: () => void) {
  const guard = useRef<PurchasingCloseCheck | null>(null);
  const [asking, setAsking] = useState(false);
  // Hộp hỏi đang chờ quyết định cho một link (đi tiếp) hay cho việc đóng panel
  const [leaving, setLeaving] = useState(false);
  const [leaveConfirmed, setLeaveConfirmed] = useState(false);
  const [anchor, setAnchor] = useState<HTMLAnchorElement | null>(null);

  // Đã xác nhận bỏ bản nháp: bấm lại đúng link đó (Link của Next đi theo `href`, không gọi router tay)
  useEffect(() => {
    if (leaveConfirmed) anchor?.click();
  }, [leaveConfirmed, anchor]);

  const requestClose = () => {
    setLeaving(false);
    const state = guard.current?.();
    if (state?.saving) return;
    if (state?.dirty) {
      setAsking(true);
      return;
    }
    onClose();
  };

  /**
   * Link `<a>` rời panel: có bản nháp mua hàng → hỏi, xác nhận mới đi; đang lưu → bỏ qua. Bấm kèm Ctrl / Cmd /
   * Shift / Alt hoặc chuột giữa mở tab khác nên panel và bản nháp còn nguyên → để trình duyệt xử lý.
   */
  const onLeaveLinkClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (leaveConfirmed) {
      setLeaveConfirmed(false);
      return;
    }
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    const state = guard.current?.();
    if (!state?.saving && !state?.dirty) return;
    event.preventDefault();
    if (state.saving) return;
    setLeaving(true);
    setAsking(true);
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
        if (leaving) {
          setLeaving(false);
          setLeaveConfirmed(true);
          return;
        }
        onClose();
      }}
    />
  );

  return { guard, requestClose, attachLeaveAnchor: setAnchor, onLeaveLinkClick, confirm };
}
