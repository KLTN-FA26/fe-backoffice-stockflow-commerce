import { z } from "zod";

import { AUTH_PATHS, MOCK_AUTH_EXPIRES_SECONDS, MOCK_LOGIN_PASSWORD } from "@/constants/auth";

import { loginRequestSchema } from "@/lib/auth/auth-schemas";

import { getMockStaffUsers, registerMockRoute } from "./mock-adapter";

const sessions = new Map<string, string>();
const unauthorized = () => ({
  status: 401,
  data: { message: "Tên đăng nhập hoặc mật khẩu không đúng" },
  headers: {},
});

export function registerAuthMockRoutes(): void {
  registerMockRoute("POST", AUTH_PATHS.login, async (config) => {
    const body: unknown = typeof config.data === "string" ? JSON.parse(config.data) : config.data;
    const parsed = loginRequestSchema.safeParse(body);
    if (!parsed.success || parsed.data.password !== MOCK_LOGIN_PASSWORD) return unauthorized();
    const users = await getMockStaffUsers();
    const user = users.find(
      (candidate) => candidate.email === parsed.data.username && candidate.active,
    );
    if (!user) return unauthorized();
    const accessToken = `mock-access-${crypto.randomUUID()}`;
    sessions.set(accessToken, user.userId);
    return {
      status: 200,
      data: { accessToken, tokenType: "Bearer", expiresInSeconds: MOCK_AUTH_EXPIRES_SECONDS },
      headers: {},
    };
  });

  registerMockRoute("GET", AUTH_PATHS.me, async (config) => {
    const bearer = z.string().safeParse(config.headers?.Authorization);
    const userId = bearer.success ? sessions.get(bearer.data.replace(/^Bearer /, "")) : undefined;
    const users = await getMockStaffUsers();
    const user = users.find((candidate) => candidate.userId === userId);
    if (!user) return unauthorized();
    return {
      status: 200,
      data: {
        userId: user.userId,
        username: user.email,
        email: user.email,
        fullName: user.fullName,
        status: user.active ? "ACTIVE" : "INACTIVE",
        roles: user.roles,
        lastLoginAt: null,
      },
      headers: {},
    };
  });

  registerMockRoute("POST", AUTH_PATHS.logout, (config) => {
    const bearer = z.string().safeParse(config.headers?.Authorization);
    const token = bearer.success ? bearer.data.replace(/^Bearer /, "") : "";
    if (!sessions.delete(token)) return unauthorized();
    return { status: 200, data: null, headers: {} };
  });
}
