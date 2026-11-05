import type { Order } from "../../types";

/** Đơn đang được xử lý vượt hạn mức — id + mã để hiện, id khách để tải công nợ hiện tại. */
export type CreditHoldTarget = Pick<Order, "orderId" | "orderNumber" | "customerId">;
