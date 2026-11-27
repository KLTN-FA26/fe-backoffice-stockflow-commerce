import { ClipboardList } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { ActionTrigger } from "@/components/shared/ObjectActions";

/** Nút chính "Tạo nhiệm vụ lấy hàng" trên header đơn đã có lệnh xuất kho (xem `createPickingTaskHref`). */
export function OrderCreateTaskLink({ href }: { href: string }) {
  return (
    <ActionTrigger icon={ClipboardList} label={UI_LABELS.fulfillment.action.create} href={href} />
  );
}
