import { AUTH_UI } from "@/constants/auth";

import { ApiError } from "@/lib/api/error";

import { getCurrentUserApi } from "./auth-api";
import { getAuthRevision, useAuthStore } from "./auth-store";

/**
 * Two different operations against GET /api/auth/me:
 *
 * - bootstrap (foreground): nothing is verified yet (`unknown`). Protected UI waits; a server or
 *   network failure keeps `unknown` + bootstrapError so the guard offers retry instead of logout.
 * - background (revalidation): a session is already shown. The store is NOT touched while the
 *   request runs, so authenticated UI and unsaved local state stay mounted. Only an authoritative
 *   401 logs out; 403/5xx/network keep the current UI (Spring still guards every later API call).
 *
 * One request is in flight at a time. A response is applied only if nothing superseded it: a
 * local login/logout (auth revision) or a cross-tab session event (generation) since it started.
 */
type Mode = "bootstrap" | "background";
/** focus: join an in-flight check. session-event: the in-flight answer may predate the change. */
export type RevalidationReason = "focus" | "session-event";

let pending: Promise<void> | null = null;
let generation = 0;
let rerun = false;

function run(mode: Mode): Promise<void> {
  const currentGeneration = ++generation;
  const revision = getAuthRevision();
  if (mode === "bootstrap") useAuthStore.getState().beginBootstrap();
  const isCurrent = () => generation === currentGeneration && getAuthRevision() === revision;
  pending = (async () => {
    try {
      const user = await getCurrentUserApi();
      if (!isCurrent()) return;
      const store = useAuthStore.getState();
      if (mode === "bootstrap") store.login(user, false);
      else store.reconcileSession(user);
    } catch (error: unknown) {
      if (!isCurrent()) return;
      const store = useAuthStore.getState();
      if (error instanceof ApiError && error.status === 401) {
        if (store.status !== "unauthenticated") store.logout(false);
      } else if (mode === "bootstrap") store.failBootstrap(AUTH_UI.bootstrapError);
    }
  })().finally(() => {
    pending = null;
    if (rerun) {
      rerun = false;
      void run(nextMode());
    }
  });
  return pending;
}

const nextMode = (): Mode =>
  useAuthStore.getState().status === "unknown" ? "bootstrap" : "background";

/** Foreground verification for an unknown session (first load, retry). Deduplicated. */
export function bootstrapSession(): Promise<void> {
  return pending ?? run("bootstrap");
}

/**
 * Non-destructive check of the shown session (focus, cross-tab event). An unknown session falls
 * back to bootstrap; nothing here ever clears an authenticated user before the answer arrives.
 */
export function revalidateSession(reason: RevalidationReason): Promise<void> {
  if (pending) {
    if (reason === "session-event") {
      generation++;
      rerun = true;
    }
    return pending;
  }
  return run(nextMode());
}
