import { redirect } from "next/navigation";

import { ADMIN_ROUTES } from "@/constants/routes";

/** Chi tiết thuộc tính biến thể cũ (dữ liệu mẫu) → từ điển thuộc tính thật. Xem `../page.tsx`. */
export default function LegacyVariantAttributeDetailPage() {
  redirect(ADMIN_ROUTES.attributes);
}
