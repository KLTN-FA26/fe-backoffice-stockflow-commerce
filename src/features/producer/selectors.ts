/** Selector thuần của danh mục đơn vị sản xuất — không side effect. */

import type { Producer } from "./types";

export interface ProducerContact {
  /** Dòng chính: người liên hệ, hoặc email khi không có người liên hệ. */
  main: string | null;
  /** Dòng phụ: phần còn lại (email · SĐT). */
  sub: string | null;
}

/** Ô "Liên hệ" của bảng: người liên hệ trên, email · SĐT dưới; thiếu phần nào bỏ phần đó. */
export function producerContact(producer: Producer): ProducerContact {
  const email = producer.email || null;
  const phone = producer.contactPhone || null;
  const main = producer.contactName || email;
  const rest = [main === email ? null : email, phone].filter(Boolean).join(" · ");
  return { main, sub: rest || null };
}

/** Đơn vị nhận Đơn sản xuất mới được không (BE 409 PRODUCER_INACTIVE). */
export const acceptsNewOrders = (producer: Pick<Producer, "status">): boolean =>
  producer.status === "ACTIVE";
