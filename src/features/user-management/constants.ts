import { PAGE_SIZE } from "@/constants";

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
  /** BE `StatusChangeReason` (SCRUM-474 LOCK-REASON): the reason of lock / unlock / disable / enable, after trimming. */
  reasonMin: 5,
  reasonMax: 500,
} as const;

/** BE `UserStatusChange` enum, as the history reports it. */
export const USER_STATUS_CHANGE_ACTIONS = ["LOCK", "UNLOCK", "DISABLE", "ENABLE"] as const;
/** Trang lịch sử trạng thái trên chi tiết tài khoản. */
export const STATUS_HISTORY_PAGE_SIZE = 10;

/** Cỡ trang chọn được: dùng lại `PAGE_SIZE` chung; BE chấp nhận tới `Pages.MAX_PAGE_SIZE` = 200. */
export const USER_PAGE_SIZE_OPTIONS = [PAGE_SIZE.sm, PAGE_SIZE.lg, PAGE_SIZE.xl] as const;

/** Chuỗi hiển thị của màn Quản lý người dùng. */
export const USER_UI = {
  title: "Quản lý người dùng",
  subtitle: "Tài khoản nhân viên: vai trò, kho làm việc, khoá / vô hiệu hoá và đặt lại mật khẩu.",
  createButton: "Thêm người dùng",
  searchPlaceholder: "Tìm theo tên đăng nhập, họ tên, email…",
  summarySearch: "Tìm kiếm",
  // Nhãn trường dùng lại ở bảng, hồ sơ và form tạo
  usernameLabel: "Tên đăng nhập",
  fullNameLabel: "Họ tên",
  emailLabel: "Email",
  rolesLabel: "Vai trò",
  statusLabel: "Trạng thái",
  lastLoginLabel: "Đăng nhập gần nhất",
  warehousesLabel: "Kho làm việc",
  warehousesShort: "Kho",
  noWarehousesAtAll: "Chưa có kho nào.",
  resetPassword: "Đặt lại mật khẩu",
  saving: "Đang lưu…",
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
  mustChangePassword: "Đang dùng mật khẩu tạm — nên đổi sau khi đăng nhập",
  temporaryLock: "Đang bị khoá tạm thời do nhập sai mật khẩu, đến",
  // SCRUM-474 LOCK-REASON: lý do bắt buộc cho khoá / mở khoá / vô hiệu hoá / kích hoạt lại
  loading: "Đang tải…",
  reasonLabel: "Lý do",
  reasonMinHint: `Nhập tối thiểu ${USER_LIMITS.reasonMin} ký tự.`,
  latestReasonLabel: "Lý do thay đổi trạng thái gần nhất",
  reasonColumn: "Lý do gần nhất",
  noReason: "—",
  historyTitle: "Lịch sử trạng thái",
  historyDescription:
    "Mỗi lần quản trị viên khoá, mở khoá, vô hiệu hoá hoặc kích hoạt lại, kèm lý do.",
  historyEmpty: "Chưa có thao tác nào.",
  historyLoadFailed: "Không tải được lịch sử trạng thái.",
  historyPrevious: "Trang trước",
  historyNext: "Trang sau",
  historyBy: "bởi",
} as const;

/** Nhãn hiển thị của từng thao tác trong lịch sử trạng thái. */
export const STATUS_CHANGE_LABELS = {
  LOCK: "Khoá",
  UNLOCK: "Mở khoá",
  DISABLE: "Vô hiệu hoá",
  ENABLE: "Kích hoạt lại",
} as const satisfies Record<(typeof USER_STATUS_CHANGE_ACTIONS)[number], string>;
