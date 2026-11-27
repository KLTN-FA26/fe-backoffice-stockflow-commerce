import Link from "next/link";

import { UI_LABELS } from "@/constants";

import { ORDER_ACTION_BUTTON } from "./useOrderActionDialog";

/** Nút "Tạo nhiệm vụ lấy hàng" trên thẻ thao tác của đơn đã có lệnh xuất kho (xem `createPickingTaskHref`). */
export function OrderCreateTaskLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className={`${ORDER_ACTION_BUTTON} bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse mb-2 inline-flex items-center justify-center`}
    >
      {UI_LABELS.fulfillment.action.create}
    </Link>
  );
}
