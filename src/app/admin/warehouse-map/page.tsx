import { redirect } from "next/navigation";

import { ADMIN_ROUTES } from "@/constants";

/** Tab "Kho & bản đồ" chọn kho ở trang Danh mục kho — vào gốc tab thì chuyển về đó. */
export default function WarehouseWorkspacePage() {
  redirect(ADMIN_ROUTES.warehouses.list);
}
