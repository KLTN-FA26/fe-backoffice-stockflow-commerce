/**
 * Auth API — login, refresh, logout, and mock-login support.
 *
 * All requests use the canonical API client so mock mode stays behind the
 * adapter boundary and production requests share the same error handling.
 */

import { api } from "@/lib/api/client";

import type { AuthUser } from "./auth-store";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export interface MockLoginUser {
  userId: string;
  fullName: string;
  email: string;
  roles: string[];
}

export async function loginApi(credentials: LoginRequest): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>("/auth/login", credentials);
  return data;
}

export async function refreshTokenApi(refreshToken: string): Promise<RefreshResponse> {
  const { data } = await api.post<RefreshResponse>("/auth/refresh", { refreshToken });
  return data;
}

export async function logoutApi(refreshToken: string): Promise<void> {
  try {
    await api.post("/auth/logout", { refreshToken });
  } catch {
    // Local logout must still complete when the server is unavailable.
  }
}

export async function mockLoginApi(userId: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>("/auth/login", { userId });
  return data;
}

export async function getMockLoginUsersApi(): Promise<MockLoginUser[]> {
  const { data } = await api.get<{ items: MockLoginUser[] }>("/staff-users");
  // Guard against an unexpected response shape (contract mismatch) so callers
  // never receive `undefined` — always a real array, even if empty.
  return Array.isArray(data?.items) ? data.items : [];
}
