import { redirect } from "next/navigation";

import { ADMIN_ROUTES } from "@/constants";

/** Link cũ "Lập Đơn sản xuất": lập chỉ từ đợt giao còn thiếu (docs 17 §4.3 bước 6) → tab "Cần lập" của lịch. */
export default function DrawUpProductionOrderPage() {
  redirect(ADMIN_ROUTES.productionScheduleDrawUp);
}
