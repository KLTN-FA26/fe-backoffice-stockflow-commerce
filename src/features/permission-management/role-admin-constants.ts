import { DATA_SCOPE_LABELS } from "@/constants";

/** Chuỗi của phần quản lý vai trò tuỳ chỉnh trên màn Phân quyền (SCRUM-458). */
export const ROLE_ADMIN = {
  create: "Tạo vai trò",
  edit: "Đổi tên / phạm vi",
  remove: "Xoá vai trò",
  systemNote:
    "Vai trò hệ thống — không đổi tên hoặc xoá được; quyền sửa trong ma trận bên dưới (nếu được phép).",
  customNote: "Vai trò tuỳ chỉnh — sửa quyền bằng ma trận bên dưới.",
  inUse: "Còn người đang giữ vai trò này — gỡ vai trò khỏi họ trước khi xoá.",
  deleteTitle: "Xoá vai trò?",
  holders: (count: number) => `${count} người đang giữ`,
  copyNone: "Vai trò trống (không có quyền nào)",
  scopeOptions: [
    { value: "ALL", label: DATA_SCOPE_LABELS.ALL },
    { value: "WAREHOUSE", label: DATA_SCOPE_LABELS.WAREHOUSE },
    { value: "OWN", label: DATA_SCOPE_LABELS.OWN },
  ],
} as const;
