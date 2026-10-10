/** UI state only. Authentication is established by the server session endpoint. */
import { create } from "zustand";

import { AUTH_STORAGE_KEY } from "@/constants/auth";

import { publishAuthEvent } from "./auth-events";
import { authUserSchema } from "./auth-schemas";
import { ROLES } from "./roles";

import type { AuthUser } from "./auth-schemas";
import type { RoleName } from "./roles";

export type { AuthUser } from "./auth-schemas";
export type AuthStatus = "unknown" | "authenticated" | "unauthenticated";
/** Discard obsolete persistence on any browser entry point, never restore it. */
export function discardLegacyAuthState() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    /* Storage may be disabled. */
  }
}
discardLegacyAuthState();

let revision = 0;
export const getAuthRevision = () => revision;

const sameProfile = (a: AuthUser, b: AuthUser) =>
  a.username === b.username &&
  a.email === b.email &&
  a.fullName === b.fullName &&
  a.status === b.status &&
  a.lastLoginAt === b.lastLoginAt &&
  a.roles.length === b.roles.length &&
  a.roles.every((role, index) => role === b.roles[index]);

interface AuthState {
  user: AuthUser | null;
  status: AuthStatus;
  bootstrapError: string | null;
  authorizationVersion: number;
  isAuthenticated: boolean;
  impersonatedRole: RoleName | null;
  setImpersonatedRole: (role: RoleName | null) => void;
  effectiveRoles: () => RoleName[];
  login: (user: AuthUser, notify?: boolean) => void;
  logout: (notify?: boolean) => void;
  reconcileSession: (user: AuthUser) => void;
  beginBootstrap: () => void;
  failBootstrap: (message: string) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  status: "unknown",
  bootstrapError: null,
  authorizationVersion: 0,
  isAuthenticated: false,
  impersonatedRole: null,
  setImpersonatedRole: (role) => set({ impersonatedRole: role }),
  effectiveRoles: () => {
    const { user, impersonatedRole } = get();
    if (!user) return [];
    if (impersonatedRole) return [impersonatedRole];
    return ROLES.filter((role) => user.roles.includes(role));
  },
  login: (user, notify = true) => {
    discardLegacyAuthState();
    const identity = authUserSchema.parse(user);
    revision++;
    set({
      authorizationVersion: get().authorizationVersion + 1,
      user: identity,
      status: "authenticated",
      isAuthenticated: true,
      bootstrapError: null,
      impersonatedRole: null,
    });
    if (notify) publishAuthEvent("session-changed");
  },
  logout: (notify = true) => {
    discardLegacyAuthState();
    revision++;
    set({
      authorizationVersion: get().authorizationVersion + 1,
      user: null,
      status: "unauthenticated",
      isAuthenticated: false,
      bootstrapError: null,
      impersonatedRole: null,
    });
    if (notify) publishAuthEvent("logout");
  },
  /**
   * Background /me success. The same user is the same session: refresh profile fields only, with
   * no revision, authorizationVersion or event - a routine focus check must not reset permission
   * queries or ping other tabs. A different (or newly discovered) user is a real session change
   * and goes through a silent login, which retires the previous identity's authorization.
   */
  reconcileSession: (user) => {
    const identity = authUserSchema.parse(user);
    const { user: current, status } = get();
    if (status === "authenticated" && current?.userId === identity.userId) {
      if (!sameProfile(current, identity)) set({ user: identity });
      return;
    }
    get().login(identity, false);
  },
  /** Foreground only: no verified session exists yet, so protected UI may not render. */
  beginBootstrap: () =>
    set({ user: null, status: "unknown", isAuthenticated: false, bootstrapError: null }),
  failBootstrap: (message) => set({ bootstrapError: message }),
}));
