import { AUTH_PATHS, MOCK_LOGIN_PASSWORD } from "@/constants/auth";

import { api } from "@/lib/api/client";

import { authTokensSchema, authUserSchema, loginRequestSchema } from "./auth-schemas";
import { useAuthStore } from "./auth-store";

import type { AuthUser, LoginRequest, LoginResponse } from "./auth-schemas";

export type { LoginRequest, LoginResponse } from "./auth-schemas";

export interface MockLoginUser {
  userId: string;
  fullName: string;
  email: string;
  roles: string[];
}

export async function loginApi(credentials: LoginRequest): Promise<LoginResponse> {
  const { data } = await api.post<unknown>(AUTH_PATHS.login, loginRequestSchema.parse(credentials));
  return authTokensSchema.parse(data);
}

export async function getCurrentUserApi(): Promise<AuthUser> {
  const { data } = await api.get<unknown>(AUTH_PATHS.me);
  return authUserSchema.parse(data);
}

/** Establish the bearer before /me; only a validated identity completes login. */
export async function completeAuthentication(tokens: LoginResponse): Promise<void> {
  const store = useAuthStore.getState();
  store.establishTokens(tokens);
  try {
    const user = await getCurrentUserApi();
    // A concurrent 401/logout must not resurrect a revoked session.
    if (useAuthStore.getState().tokens !== tokens) {
      throw new Error("Phiên đăng nhập đã kết thúc.");
    }
    store.login(user, tokens);
  } catch (error: unknown) {
    store.logout();
    throw error;
  }
}

/** User-triggered logout: send the bearer first, always clear local state afterwards. */
export async function logoutApi(): Promise<void> {
  try {
    await api.post(AUTH_PATHS.logout);
  } catch {
    // Logout deliberately tolerates a revoked session or unavailable server.
  } finally {
    useAuthStore.getState().logout();
  }
}

/** Demo selection resolves to a username without changing the production DTO. */
export async function mockLoginApi(userId: string): Promise<LoginResponse> {
  const users = await getMockLoginUsersApi();
  const user = users.find((candidate) => candidate.userId === userId);
  if (!user) throw new Error("Không tìm thấy tài khoản demo.");
  return loginApi({ username: user.email, password: MOCK_LOGIN_PASSWORD });
}

export async function getMockLoginUsersApi(): Promise<MockLoginUser[]> {
  const { data } = await api.get<{ items: MockLoginUser[] }>("/staff-users");
  return Array.isArray(data?.items) ? data.items : [];
}
