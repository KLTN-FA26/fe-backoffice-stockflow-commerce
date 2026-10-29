export const AUTH_PATHS = {
  login: "/auth/login",
  me: "/auth/me",
  logout: "/auth/logout",
  password: "/auth/password",
} as const;
export const BROWSER_API_BASE = "/api/backend";
export const AUTH_API_BASE = "/api";
/** Browser axios → Next BFF. */
export const BROWSER_API_TIMEOUT_MS = 15_000;
/** Next BFF → Spring (server-side fetch abort). */
export const BFF_UPSTREAM_TIMEOUT_MS = 15_000;
/**
 * Transport text of every BFF error body. Deliberately generic: browsers branch on `code`, and
 * user-facing copy (e.g. LOGIN_ERROR_MESSAGES) is chosen by code, never from this sentence.
 */
export const BFF_ERROR_MESSAGE = "Không thể hoàn tất yêu cầu.";
/** Codes the BFF auth routes (/api/auth/*) return themselves. */
export const AUTH_ERROR_CODES = {
  csrfRejected: "CSRF_REJECTED",
  /** Login body is not valid JSON or not { username, password }. */
  invalidCredentials: "INVALID_CREDENTIALS",
  /** Spring login failure outside LOGIN_ERROR_CODES. */
  loginFailed: "LOGIN_FAILED",
  unauthenticated: "UNAUTHENTICATED",
  sessionBootstrapFailed: "SESSION_BOOTSTRAP_FAILED",
  authUpstreamFailure: "AUTH_UPSTREAM_FAILURE",
  /** Change-password body is not valid JSON or not { currentPassword, newPassword, logoutOtherDevices }. */
  invalidPasswordChange: "INVALID_PASSWORD_CHANGE",
} as const;
/** Codes the generic /api/backend/* proxy returns itself (Spring's own codes pass through). */
export const PROXY_ERROR_CODES = {
  invalidBackendPath: "INVALID_BACKEND_PATH",
  /** Same names as BE ErrorCode, so the browser handles BFF and Spring rejections alike. */
  payloadTooLarge: "PAYLOAD_TOO_LARGE",
  malformedRequest: "MALFORMED_REQUEST",
  unsafeUpstreamResponse: "UNSAFE_UPSTREAM_RESPONSE",
  backendUnavailable: "BACKEND_UNAVAILABLE",
} as const;
export const AUTH_COOKIE_NAME = "stockflow-session";
export const LEGACY_AUTH_COOKIE_NAME = "stockflow-auth-token";
export const AUTH_STORAGE_KEY = "stockflow-auth";
export const AUTH_EVENT_CHANNEL = "stockflow-session-events";
export const AUTH_EVENT_STORAGE_KEY = "stockflow:auth:event";
export const AUTH_UI = {
  bootstrapError: "Không thể xác minh phiên đăng nhập.",
  verifyingSession: "Đang xác minh phiên đăng nhập",
  retry: "Thử lại",
} as const;
/**
 * BE `ErrorCode` names (ApiResponse.errorCode) a failed login may keep through the BFF. Explicit
 * allow-list: any other upstream code becomes AUTH_ERROR_CODES.loginFailed, so new BE codes are
 * never exposed by accident. UNAUTHORIZED 401 (unknown user OR wrong password - never
 * distinguished), ACCOUNT_NOT_ACTIVE 403, ACCOUNT_TEMPORARILY_LOCKED 403 (BE #72),
 * TEMPORARY_PASSWORD_EXPIRED 403 (SCRUM-474 FIRST-LOGIN: temporary password older than 72 h,
 * revealed only after the right password), RATE_LIMITED 429.
 */
export const LOGIN_ERROR_CODES = [
  "UNAUTHORIZED",
  "ACCOUNT_NOT_ACTIVE",
  "ACCOUNT_TEMPORARILY_LOCKED",
  "TEMPORARY_PASSWORD_EXPIRED",
  "RATE_LIMITED",
] as const;
export type LoginErrorCode = (typeof LOGIN_ERROR_CODES)[number];
/** Login-page copy keyed by ApiError.code; the UI owns the wording, never the BE message. */
export const LOGIN_ERROR_MESSAGES: Readonly<Record<LoginErrorCode | "NETWORK_ERROR", string>> = {
  UNAUTHORIZED: "Tên đăng nhập hoặc mật khẩu không đúng.",
  ACCOUNT_NOT_ACTIVE: "Tài khoản hiện không thể đăng nhập. Vui lòng liên hệ quản trị viên.",
  ACCOUNT_TEMPORARILY_LOCKED:
    "Tài khoản tạm thời bị khóa do đăng nhập sai nhiều lần. Vui lòng thử lại sau.",
  TEMPORARY_PASSWORD_EXPIRED:
    "Mật khẩu tạm đã hết hạn (quá 72 giờ). Vui lòng liên hệ quản trị viên để đặt lại mật khẩu.",
  RATE_LIMITED: "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.",
  NETWORK_ERROR: "Không kết nối được máy chủ. Vui lòng kiểm tra mạng.",
};
export const LOGIN_ERROR_FALLBACK = "Đăng nhập thất bại. Vui lòng thử lại.";
export const MOCK_AUTH_EXPIRES_SECONDS = 28800;
export const MOCK_LOGIN_PASSWORD = "mock-only";

/**
 * BE `ErrorCode` (SCRUM-474 FIRST-LOGIN): while the account still has an administrator-set password
 * every call but /me, /me/permissions, PUT /auth/password and POST /auth/logout answers 403 with
 * this code. The api client reacts by sending the user to the change-password page.
 */
export const PASSWORD_CHANGE_REQUIRED_CODE = "PASSWORD_CHANGE_REQUIRED";
/**
 * Codes the BFF keeps from a failed PUT /identity/auth/password (explicit allow-list, like
 * LOGIN_ERROR_CODES): INVALID_CURRENT_PASSWORD 400 (a 400, never 401, so the form marks the field
 * instead of signing the user out), PASSWORD_UNCHANGED 400, VALIDATION_FAILED 400,
 * ACCOUNT_NOT_ACTIVE 403, RATE_LIMITED 429 (5 attempts / 5 min).
 */
export const CHANGE_PASSWORD_ERROR_CODES = [
  "INVALID_CURRENT_PASSWORD",
  "PASSWORD_UNCHANGED",
  "VALIDATION_FAILED",
  "ACCOUNT_NOT_ACTIVE",
  "RATE_LIMITED",
] as const;
export type ChangePasswordErrorCode = (typeof CHANGE_PASSWORD_ERROR_CODES)[number];
/** BE `PasswordPolicy`: 10-72 characters with an upper-case letter, a lower-case letter and a digit. */
export const PASSWORD_LIMITS = {
  min: 10,
  max: 72,
  pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
} as const;
export const CHANGE_PASSWORD_UI = {
  title: "Đổi mật khẩu",
  forcedTitle: "Đổi mật khẩu để tiếp tục",
  forcedDescription:
    "Mật khẩu hiện tại do quản trị viên đặt. Bạn cần tự đặt mật khẩu mới trước khi dùng hệ thống; các thiết bị khác đang đăng nhập sẽ bị đăng xuất, phiên này được giữ lại.",
  description: "Nhập mật khẩu hiện tại và mật khẩu mới của bạn.",
  currentLabel: "Mật khẩu hiện tại",
  newLabel: "Mật khẩu mới",
  newHint: `${PASSWORD_LIMITS.min}–${PASSWORD_LIMITS.max} ký tự, gồm chữ hoa, chữ thường và chữ số.`,
  confirmLabel: "Nhập lại mật khẩu mới",
  logoutOthersLabel: "Đăng xuất các thiết bị khác",
  submit: "Đổi mật khẩu",
  submitting: "Đang đổi mật khẩu...",
  logout: "Đăng xuất",
  back: "Quay lại",
  success: "Đã đổi mật khẩu.",
  successOthers: (count: number) =>
    count > 0 ? `Đã đổi mật khẩu và đăng xuất ${count} thiết bị khác.` : "Đã đổi mật khẩu.",
  currentRequired: "Nhập mật khẩu hiện tại.",
  newRequired: `Mật khẩu mới ${PASSWORD_LIMITS.min}–${PASSWORD_LIMITS.max} ký tự, gồm chữ hoa, chữ thường và chữ số.`,
  confirmMismatch: "Mật khẩu nhập lại không khớp.",
  sameAsCurrent: "Mật khẩu mới phải khác mật khẩu hiện tại.",
} as const;
/** Change-password copy keyed by ApiError.code; the UI owns the wording, never the BE message. */
export const CHANGE_PASSWORD_ERROR_MESSAGES: Readonly<
  Record<ChangePasswordErrorCode | "NETWORK_ERROR", string>
> = {
  INVALID_CURRENT_PASSWORD: "Mật khẩu hiện tại không đúng.",
  PASSWORD_UNCHANGED: CHANGE_PASSWORD_UI.sameAsCurrent,
  VALIDATION_FAILED: CHANGE_PASSWORD_UI.newRequired,
  ACCOUNT_NOT_ACTIVE: "Tài khoản hiện không thể đổi mật khẩu. Vui lòng liên hệ quản trị viên.",
  RATE_LIMITED: "Bạn đã thử đổi mật khẩu quá nhiều lần. Vui lòng thử lại sau vài phút.",
  NETWORK_ERROR: "Không kết nối được máy chủ. Vui lòng kiểm tra mạng.",
};
export const CHANGE_PASSWORD_FALLBACK = "Không đổi được mật khẩu. Vui lòng thử lại.";
