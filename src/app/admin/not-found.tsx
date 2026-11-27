import { ADMIN_ROUTES, UI_LABELS } from "@/constants";

import { NotFoundView } from "@/components/shared/NotFoundView";

/** 404 trong khung quản trị (trình đơn bên trái vẫn còn): nhân viên đi tiếp được mà không phải gõ lại địa chỉ. */
export default function AdminNotFound() {
  return <NotFoundView actions={[{ href: ADMIN_ROUTES.home, label: UI_LABELS.notFound.admin }]} />;
}
