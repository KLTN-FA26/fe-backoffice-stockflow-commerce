"use client";

import { useEffect } from "react";

/**
 * Gắn `data-mode="storefront"` lên `<html>` khi đang ở portal khách hàng: dialog, popover và toast
 * của Radix / sonner render ra `body`, ngoài cây của shell — nếu chỉ gắn trên div thì chúng giữ
 * token Mode A (ink, mật độ dày). Gỡ khi rời portal để /admin không nhận caramel.
 */
export function useStorefrontMode() {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.mode = "storefront";
    return () => {
      delete root.dataset.mode;
    };
  }, []);
}
