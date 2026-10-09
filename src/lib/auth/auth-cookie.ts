/**
 * Auth cookie — bridges zustand (localStorage) ↔ Next.js middleware (cookies).
 *
 * The Next.js proxy runs on the server and cannot read localStorage.
 * On login we set a simple cookie with the access token so the middleware
 * can use its presence as a routing hint. The cookie is HttpOnly=false so JS can set it,
 * but it's NOT used for API auth — that goes through the Authorization header.
 */

const COOKIE_NAME = "stockflow-auth-token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/** Set the auth cookie after successful login. */
export function setAuthCookie(accessToken: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=${accessToken}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

/** Remove the auth cookie on logout. */
export function removeAuthCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}

/** Read the auth cookie (client-side only). */
export function getAuthCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}
