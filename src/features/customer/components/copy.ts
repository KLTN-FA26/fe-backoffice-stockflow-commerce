import type { LoadErrorCopy } from "@/components/backoffice/LoadErrorState";

export const CUSTOMER_COPY: LoadErrorCopy = {
  pageTitle: "Khách hàng",
  notFoundTitle: "Không tìm thấy khách hàng",
  notFoundDescription: "Khách hàng không tồn tại hoặc đường dẫn không hợp lệ.",
  forbiddenDescription:
    "Tài khoản của bạn chưa được cấp quyền xem khách hàng (chỉ Sales / Quản trị TMĐT).",
  noReadDescription:
    "Bạn được mở trang nhưng chưa có quyền xem dữ liệu khách hàng. Liên hệ quản trị để được cấp.",
};
