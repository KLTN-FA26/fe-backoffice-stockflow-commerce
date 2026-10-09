export const AUTH_PATHS = {
  login: "/identity/auth/login",
  me: "/identity/me",
  logout: "/identity/auth/logout",
} as const;

export const AUTH_STORAGE_KEY = "stockflow-auth";
export const AUTH_STORAGE_VERSION = 1;
export const MOCK_AUTH_EXPIRES_SECONDS = 28800;
export const MOCK_LOGIN_PASSWORD = "mock-only";
