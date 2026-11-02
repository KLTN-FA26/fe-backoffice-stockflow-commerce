import { AUTH_API_BASE, AUTH_PATHS, MOCK_LOGIN_PASSWORD } from "@/constants/auth";

import { api } from "@/lib/api/client";

import {
  authUserSchema,
  changePasswordRequestSchema,
  changePasswordResultSchema,
  loginRequestSchema,
} from "./auth-schemas";
import { useAuthStore } from "./auth-store";

import type {
  AuthUser,
  ChangePasswordRequest,
  ChangePasswordResult,
  LoginRequest,
  LoginResponse,
} from "./auth-schemas";

export type { LoginRequest, LoginResponse } from "./auth-schemas";

export interface MockLoginUser {
  userId: string;
  fullName: string;
  email: string;
  roles: string[];
}

export async function loginApi(credentials: LoginRequest): Promise<LoginResponse> {
  const { data } = await api.post<unknown>(
    AUTH_PATHS.login,
    loginRequestSchema.parse(credentials),
    { baseURL: AUTH_API_BASE },
  );
  const user = authUserSchema.parse(data);
  useAuthStore.getState().login(user);
  return user;
}

export async function getCurrentUserApi(): Promise<AuthUser> {
  const { data } = await api.get<unknown>(AUTH_PATHS.me, { baseURL: AUTH_API_BASE });
  return authUserSchema.parse(data);
}

/**
 * Self-service password change (SCRUM-474 FIRST-LOGIN). The session is kept (the BFF cookie stays
 * valid); when the change was forced the BE also signs every other device out. Afterwards /me is
 * asked again so the store drops `mustChangePassword` and the guard lets the user in.
 */
export async function changePasswordApi(
  request: ChangePasswordRequest,
): Promise<ChangePasswordResult> {
  const { data } = await api.put<unknown>(
    AUTH_PATHS.password,
    changePasswordRequestSchema.parse(request),
    { baseURL: AUTH_API_BASE },
  );
  const result = changePasswordResultSchema.parse(data);
  // The password HAS changed here. A failing /me must not turn that into a reported failure: the BE already lifted
  // the gate, so clear the flag locally and let the next focus / session check reconcile the profile.
  useAuthStore.getState().markPasswordChanged();
  try {
    useAuthStore.getState().reconcileSession(await getCurrentUserApi());
  } catch {
    /* profile refresh is best effort */
  }
  return result;
}

/** User-triggered logout: ask the server to revoke first, always clear local state afterwards. */
export async function logoutApi(): Promise<void> {
  try {
    await api.post(AUTH_PATHS.logout, undefined, { baseURL: AUTH_API_BASE });
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
