import "server-only";

import { AUTH_ERROR_CODES, CHANGE_PASSWORD_ERROR_CODES, LOGIN_ERROR_CODES } from "@/constants/auth";

const SAFE_LOGIN_ERROR_CODES: ReadonlySet<string> = new Set(LOGIN_ERROR_CODES);
const SAFE_CHANGE_PASSWORD_ERROR_CODES: ReadonlySet<string> = new Set(CHANGE_PASSWORD_ERROR_CODES);
// RateLimitInterceptor publishes whole seconds; anything else (dates, junk) is dropped.
const RETRY_AFTER_SECONDS = /^\d{1,9}$/;

export interface LoginFailure {
  readonly code: string;
  readonly retryAfter?: string;
}

/**
 * Reads only `errorCode` from Spring's failure envelope (ApiResponse). Unknown codes, missing
 * codes, HTML gateway pages and malformed JSON all collapse to LOGIN_FAILED; the backend message
 * is never forwarded - the login page owns the wording.
 */
export async function readLoginFailure(upstream: Response): Promise<LoginFailure> {
  return readFailure(upstream, SAFE_LOGIN_ERROR_CODES, AUTH_ERROR_CODES.loginFailed);
}

/** Same rules for a failed PUT /identity/auth/password: only the allow-listed codes survive. */
export async function readChangePasswordFailure(upstream: Response): Promise<LoginFailure> {
  return readFailure(
    upstream,
    SAFE_CHANGE_PASSWORD_ERROR_CODES,
    AUTH_ERROR_CODES.authUpstreamFailure,
  );
}

async function readFailure(
  upstream: Response,
  safeCodes: ReadonlySet<string>,
  fallback: string,
): Promise<LoginFailure> {
  let code: string = fallback;
  try {
    const body: unknown = await upstream.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "errorCode" in body &&
      typeof body.errorCode === "string" &&
      safeCodes.has(body.errorCode)
    )
      code = body.errorCode;
  } catch {
    /* Non-JSON upstream error stays generic. */
  }
  const retryAfter = upstream.headers.get("Retry-After")?.trim();
  return upstream.status === 429 && retryAfter && RETRY_AFTER_SECONDS.test(retryAfter)
    ? { code, retryAfter }
    : { code };
}
