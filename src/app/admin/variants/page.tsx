import { redirect } from "next/navigation";

import { ADMIN_ROUTES } from "@/constants/routes";

/**
 * Màn "Thuộc tính biến thể" cũ dựng từ dữ liệu mẫu đã được thay bằng từ điển thuộc tính thật (BE PR
 * #113) ở `/admin/attributes`; trục của từng sản phẩm sửa trong trang chi tiết sản phẩm. Giữ route để
 * liên kết / dấu trang cũ không gãy.
 */
export default function LegacyVariantAttributesPage() {
  redirect(ADMIN_ROUTES.attributes);
}
