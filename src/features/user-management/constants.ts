/** BE `UserStatus` (identity/internal/domain/UserStatus.java). */
export const USER_STATUSES = ["ACTIVE", "LOCKED", "DISABLED"] as const;

/** Hành động đổi trạng thái — mỗi giá trị là một đoạn cuối của `POST /identity/users/{id}/{action}`. */
export const USER_STATUS_ACTIONS = ["lock", "unlock", "disable", "enable"] as const;

/** `UserManagementController.list` — `sort` chỉ nhận các trường này (IdentityServiceImpl SortWhitelist). */
export const USER_SORT_FIELDS = [
  "username",
  "fullName",
  "status",
  "lastLoginAt",
  "createdAt",
] as const;

/**
 * Giới hạn đầu vào — `CreateUserRequest` / `UpdateUserRequest` / `PasswordPolicy` của BE PR #72.
 * Mật khẩu: 10–72 ký tự, có chữ hoa, chữ thường và chữ số (PasswordPolicy.PATTERN).
 */
export const USER_LIMITS = {
  usernamePattern: /^[A-Za-z0-9._-]{3,100}$/,
  emailMax: 320,
  fullNameMax: 200,
  passwordMin: 10,
  passwordMax: 72,
  passwordPattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
  rolesMax: 20,
  warehousesMax: 50,
  pageSizes: [10, 20, 50] as const,
  defaultPageSize: 20,
} as const;

/** Chuỗi hiển thị của màn Quản lý người dùng. */
export const USER_UI = {
  title: "Quản lý người dùng",
  subtitle: "Tài khoản nhân viên: vai trò, kho làm việc, khoá / vô hiệu hoá và đặt lại mật khẩu.",
  createButton: "Thêm người dùng",
  searchPlaceholder: "Tìm theo tên đăng nhập, họ tên, email…",
  allStatuses: "Tất cả",
  allRoles: "Tất cả vai trò",
  roleFilter: "Lọc theo vai trò",
  noRead: "Bạn không có quyền xem danh sách người dùng.",
  emptyTitle: "Chưa có người dùng",
  emptyDescription: "Hệ thống chưa có tài khoản nhân viên nào.",
  noResultsTitle: "Không tìm thấy kết quả",
  noResultsDescription: "Không có người dùng nào khớp từ khoá hoặc bộ lọc hiện tại.",
  clearFilters: "Bỏ bộ lọc",
  retry: "Thử lại",
  loadFailed: "Không tải được danh sách người dùng.",
  neverSignedIn: "Chưa đăng nhập",
  noWarehouse: "Chưa gán kho",
  noRoles: "Chưa có vai trò",
  selfNotice: "Đây là tài khoản của bạn — hệ thống không cho tự thay đổi tại màn này.",
  mustChangePassword: "Phải đổi mật khẩu ở lần đăng nhập tới",
  temporaryLock: "Đang bị khoá tạm thời do nhập sai mật khẩu, đến",
} as const;
