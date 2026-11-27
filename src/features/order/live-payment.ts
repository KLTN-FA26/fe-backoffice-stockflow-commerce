import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { toast } from "@/components/shared/Toast";

import { orderKeys } from "./queries";
import type { Order } from "./types";

/**
 * Trang đơn hỏi lại bao lâu một lần khi đơn đang chờ khách trả đợt khi ký. Tiền chuyển khoản do bank feed
 * (webhook SePay) ghi nhận trong vài giây rồi đơn tự sang CONFIRMED; không có websocket nào mang trạng thái
 * đơn / thanh toán (websocket chỉ cho chat), nên trang tự hỏi lại — tab bị ẩn thì không hỏi.
 */
export const LIVE_PAYMENT_POLL_MS = 5_000;

/** Trạng thái đơn (dạng hiển thị của FE, `PENDING_PAYMENT` của BE) mà tiền về sẽ đổi được: chờ khách trả đợt khi ký (15 BR-07). */
const AWAITING_PAYMENT: Order["status"] = "Pending Payment";

/**
 * Khi đơn "Chờ thanh toán": cứ {@link LIVE_PAYMENT_POLL_MS} hỏi lại đơn và các đợt thanh toán của nó (tab đang
 * mở), và hỏi ngay khi người dùng quay lại tab. Khi trạng thái đơn đổi ngay trên trang này (tiền về → Đã xác nhận),
 * làm mới mọi khối của trang một lần — hợp đồng, khối thanh toán, lịch sử — và báo cho người đang xem.
 *
 * @param routeId id trên URL — khoá của `useOrder` (có thể khác cách viết `order.orderId`)
 */
export function useLiveOrderPayment(routeId: string, order: Order | undefined) {
  const queryClient = useQueryClient();
  const watching = order?.status === AWAITING_PAYMENT;
  const orderId = order?.orderId;

  useEffect(() => {
    if (!watching || !orderId) return;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      void queryClient.invalidateQueries({ queryKey: orderKeys.detail(routeId) });
      void queryClient.invalidateQueries({ queryKey: orderKeys.installmentsSummary(orderId) });
    };
    const timer = window.setInterval(refresh, LIVE_PAYMENT_POLL_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [watching, routeId, orderId, queryClient]);

  // Trạng thái lần trước trang này thấy — chỉ báo khi đơn rời "Chờ thanh toán" lúc đang mở trang.
  const seen = useRef<string | undefined>(undefined);
  useEffect(() => {
    const status = order?.status;
    if (!status) return;
    const before = seen.current;
    seen.current = status;
    if (before !== AWAITING_PAYMENT || status === AWAITING_PAYMENT) return;
    // Mọi khối khác của trang (hợp đồng, đợt thanh toán, lịch sử, kho xuất) đọc lại một lần.
    void queryClient.invalidateQueries();
    if (status === "Confirmed") {
      toast.success(
        `Đơn ${order?.orderNumber ?? ""} đã được xác nhận`,
        "Đã nhận đủ tiền đợt khi ký — có thể chọn kho xuất.",
      );
    }
  }, [order?.status, order?.orderNumber, queryClient]);
}
