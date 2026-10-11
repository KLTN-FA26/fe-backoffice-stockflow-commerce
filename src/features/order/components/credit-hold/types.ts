import type { Order } from "../../types";

/** Đơn đang được xử lý vượt hạn mức — chỉ cần id + mã để hiện trong dialog. */
export type CreditHoldTarget = Pick<Order, "orderId" | "orderNumber">;
