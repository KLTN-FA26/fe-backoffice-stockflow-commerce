export const AUTH_PATHS = { login: "/auth/login", me: "/auth/me", logout: "/auth/logout" } as const;
export const BROWSER_API_BASE = "/api/backend";
export const AUTH_API_BASE = "/api";
export const AUTH_COOKIE_NAME = "stockflow-session";
export const LEGACY_AUTH_COOKIE_NAME = "stockflow-auth-token";
export const AUTH_STORAGE_KEY = "stockflow-auth";
export const AUTH_EVENT_CHANNEL = "stockflow-session-events";
export const AUTH_EVENT_STORAGE_KEY = "stockflow:auth:event";
export const AUTH_UI = {
  bootstrapError: "Không thể xác minh phiên đăng nhập.",
  retry: "Thử lại",
} as const;
export const MOCK_AUTH_EXPIRES_SECONDS = 28800;
export const MOCK_LOGIN_PASSWORD = "mock-only";
