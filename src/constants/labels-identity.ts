/**
 * Quản lý người dùng & vai trò — mã lỗi BE (`ErrorCode`, PR #72 SCRUM-453/#73 SCRUM-457) → câu tiếng Việt.
 *
 * FE chỉ rẽ nhánh theo `errorCode`, không theo câu chữ của BE. Các mã 403/409 của luật "chỉ cấp được
 * thứ mình đang có" (SCRUM-456) là phần người quản trị hay gặp nhất nên có câu giải thích riêng.
 */
export const IDENTITY_ERROR_MESSAGES = {
  // 403 — luật SCRUM-456
  PRIVILEGE_ESCALATION:
    "Bạn không thể cấp hoặc quản lý quyền mà chính tài khoản của bạn không có. Hãy nhờ quản trị viên có đủ quyền thực hiện.",
  OWN_ACCOUNT_NOT_MANAGEABLE:
    "Bạn không thể thay đổi tài khoản của chính mình tại màn Quản lý người dùng.",
  ACCOUNT_TEMPORARILY_LOCKED:
    "Tài khoản đang bị khoá tạm thời do nhập sai mật khẩu nhiều lần. Hãy mở khoá tài khoản hoặc đợi hết thời gian khoá.",
  OUT_OF_DATA_SCOPE: "Dữ liệu này nằm ngoài phạm vi kho bạn được phép truy cập.",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
  // 404
  USER_NOT_FOUND: "Không tìm thấy tài khoản này. Có thể tài khoản đã bị xoá.",
  ROLE_NOT_FOUND: "Không tìm thấy vai trò này.",
  WAREHOUSE_NOT_FOUND: "Có kho được chọn không còn tồn tại. Hãy tải lại danh sách kho.",
  // 400
  VALIDATION_FAILED: "Dữ liệu chưa hợp lệ. Hãy kiểm tra các ô được báo lỗi.",
  UNSUPPORTED_PARAMETER: "Bộ lọc hoặc cách sắp xếp không được hỗ trợ.",
  UNKNOWN_PERMISSION: "Có quyền không còn tồn tại trên máy chủ. Hãy tải lại trang.",
  // 409
  USERNAME_ALREADY_EXISTS: "Tên đăng nhập này đã tồn tại (không phân biệt hoa thường).",
  USER_EMAIL_ALREADY_EXISTS: "Email này đã được dùng cho một tài khoản khác.",
  ROLE_CODE_ALREADY_EXISTS: "Mã vai trò này đã tồn tại (không phân biệt hoa thường).",
  ROLE_IN_USE: "Vai trò vẫn đang được gán cho người dùng. Hãy gỡ vai trò khỏi họ trước khi xoá.",
  SYSTEM_ROLE_IMMUTABLE: "Vai trò hệ thống không thể đổi tên hoặc xoá.",
  ROLE_NOT_EDITABLE: "Quyền của vai trò này không sửa được ở đây.",
  ROLE_PERMISSIONS_CHANGED:
    "Quyền của vai trò vừa được người khác thay đổi. Hãy tải lại rồi thử lại.",
  RBAC_LOCKOUT: "Phải còn ít nhất một vai trò giữ quyền quản lý phân quyền.",
  LAST_SYSTEM_ADMIN:
    "Phải còn ít nhất một quản trị viên hệ thống đang hoạt động. Hãy chỉ định người khác trước khi thay đổi này.",
  ROLE_NOT_ASSIGNABLE:
    "Vai trò này không thể gán cho tài khoản này (vai trò khách hàng chỉ dành cho tài khoản khách hàng).",
  INVALID_USER_STATUS_TRANSITION:
    "Tài khoản không thể chuyển sang trạng thái này từ trạng thái hiện tại. Hãy tải lại để xem trạng thái mới nhất.",
  STAFF_ACCOUNT_REQUIRED: "Đây là tài khoản khách hàng — hãy quản lý ở màn hình khách hàng.",
  OPTIMISTIC_LOCK:
    "Dữ liệu vừa được người khác thay đổi. Đã tải lại bản mới nhất — hãy kiểm tra rồi thử lại.",
  generic: "Không thực hiện được. Vui lòng thử lại.",
  network: "Không kết nối được máy chủ. Vui lòng kiểm tra mạng.",
} as const;

export type IdentityErrorCode = Exclude<
  keyof typeof IDENTITY_ERROR_MESSAGES,
  "generic" | "network"
>;

/** Lỗi theo `errorCode` gắn vào một ô của form (BE trả 409 trùng không kèm `fieldErrors`). */
export const IDENTITY_FIELD_ERROR_CODES = {
  USERNAME_ALREADY_EXISTS: "username",
  USER_EMAIL_ALREADY_EXISTS: "email",
  ROLE_CODE_ALREADY_EXISTS: "code",
} as const;

/** Nhãn phạm vi dữ liệu của vai trò (BE `app_role.data_scope`, PR #73). */
export const DATA_SCOPE_LABELS = {
  OWN: "Chỉ dữ liệu của chính mình",
  TEAM: "Theo nhóm",
  WAREHOUSE: "Theo kho được gán",
  ALL: "Toàn bộ dữ liệu",
} as const;

/** Toast thành công của màn Quản lý người dùng / vai trò. */
export const IDENTITY_TOAST_MESSAGES = {
  user: {
    created: "Đã tạo tài khoản",
    updated: "Đã lưu hồ sơ",
    warehousesSaved: "Đã cập nhật kho làm việc",
    roleAssigned: "Đã gán vai trò",
    roleRevoked: "Đã gỡ vai trò",
    locked: "Đã khoá tài khoản và đăng xuất mọi phiên",
    unlocked: "Đã mở khoá tài khoản",
    disabled: "Đã vô hiệu hoá tài khoản và đăng xuất mọi phiên",
    enabled: "Đã kích hoạt lại tài khoản",
    passwordReset: "Đã đặt lại mật khẩu",
  },
  role: {
    created: "Đã tạo vai trò",
    updated: "Đã lưu vai trò",
    deleted: "Đã xoá vai trò",
  },
} as const;

/**
 * Vai trò không bao giờ gán cho tài khoản nhân viên: CUSTOMER thuộc tài khoản khách hàng
 * (BE `IdentityServiceImpl` → `ROLE_NOT_ASSIGNABLE`, PR #72 SCRUM-456). Đây là luật về NGƯỜI ĐƯỢC GÁN,
 * không phải kiểm quyền của người gọi.
 */
export const NON_STAFF_ROLE_CODES: readonly string[] = ["CUSTOMER"];
