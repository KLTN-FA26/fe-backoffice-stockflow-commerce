import { redirect } from "next/navigation";

import { ADMIN_ROUTES } from "@/constants";

/** Gợi ý vị trí làm việc theo một kho — link cũ chuyển về Danh mục kho để chọn kho. */
export default function LegacySlottingPage() {
  redirect(ADMIN_ROUTES.warehouses.list);
}
