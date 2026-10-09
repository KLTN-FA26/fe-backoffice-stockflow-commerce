/** Access-token auth state. logout() is force-local; user logout uses logoutApi(). */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { z } from "zod";

import { AUTH_STORAGE_KEY, AUTH_STORAGE_VERSION } from "@/constants/auth";

import { getAuthCookie, removeAuthCookie, setAuthCookie } from "./auth-cookie";
import { authTokensSchema, authUserSchema } from "./auth-schemas";
import { ROLES } from "./roles";

import type { AuthTokens, AuthUser } from "./auth-schemas";
import type { RoleName } from "./roles";

export type { AuthTokens, AuthUser } from "./auth-schemas";

const signedOutState = { user: null, tokens: null, isAuthenticated: false };
const persistedAuthSchema = z.object({
  user: authUserSchema,
  tokens: authTokensSchema,
  isAuthenticated: z.literal(true),
});

interface AuthState {
  /* ── Data ────────────────────────────────────────────────────────── */
  user: AuthUser | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;

  /* ── Role impersonation (dev/demo only) ─────────────────────────── */
  impersonatedRole: RoleName | null;
  setImpersonatedRole: (r: RoleName | null) => void;

  /* ── Effective roles (respects impersonation) ───────────────────── */
  effectiveRoles: () => RoleName[];

  /* ── Actions ────────────────────────────────────────────────────── */
  login: (user: AuthUser, tokens: AuthTokens) => void;
  establishTokens: (tokens: AuthTokens) => void;
  logout: () => void;
  synchronizeCookie: () => void;
}

/* ── Store ────────────────────────────────────────────────────────────── */

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,

      impersonatedRole: null,
      setImpersonatedRole: (r) => set({ impersonatedRole: r }),

      effectiveRoles: () => {
        const { user, impersonatedRole } = get();
        if (!user) return [];
        if (impersonatedRole) return [impersonatedRole];
        return ROLES.filter((role) => user.roles.includes(role));
      },

      login: (user, tokens) => {
        setAuthCookie(tokens.accessToken);
        set({ user, tokens, isAuthenticated: true, impersonatedRole: null });
      },

      establishTokens: (tokens) => {
        removeAuthCookie();
        set({ tokens, user: null, isAuthenticated: false, impersonatedRole: null });
      },

      synchronizeCookie: () => {
        const { user, tokens, isAuthenticated } = get();
        if (!isAuthenticated || !user || !tokens?.accessToken) {
          removeAuthCookie();
        } else if (getAuthCookie() !== tokens.accessToken) {
          setAuthCookie(tokens.accessToken);
        }
      },

      logout: () => {
        removeAuthCookie();
        set({
          user: null,
          tokens: null,
          isAuthenticated: false,
          impersonatedRole: null,
        });
      },
    }),
    {
      name: AUTH_STORAGE_KEY,
      version: AUTH_STORAGE_VERSION,
      // Hydrate after client mount so SSR and the first client render both wait.
      skipHydration: true,
      // Old sessions cannot establish identity under the new contract. Require login again.
      migrate: () => {
        removeAuthCookie();
        return signedOutState;
      },
      merge: (persisted: unknown, current) => {
        const result = persistedAuthSchema.safeParse(persisted);
        if (!result.success) {
          removeAuthCookie();
          return { ...current, ...signedOutState, impersonatedRole: null };
        }
        return { ...current, ...result.data, impersonatedRole: null };
      },
      onRehydrateStorage: () => (_state, error) => {
        if (error) removeAuthCookie();
        else _state?.synchronizeCookie();
      },
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          if (typeof window === "undefined") return null;
          try {
            const raw = localStorage.getItem(name);
            if (raw !== null) JSON.parse(raw);
            return raw;
          } catch {
            removeAuthCookie();
            return null;
          }
        },
        setItem: (name, value) => {
          if (typeof window !== "undefined") localStorage.setItem(name, value);
        },
        removeItem: (name) => {
          if (typeof window !== "undefined") localStorage.removeItem(name);
        },
      })),
      partialize: (state) => ({
        ...(state.isAuthenticated
          ? { user: state.user, tokens: state.tokens, isAuthenticated: true }
          : signedOutState),
        // Don't persist impersonatedRole — reset on page refresh
      }),
    },
  ),
);
