import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { AUTH_ERROR_CODES, PROXY_ERROR_CODES } from "@/constants/auth";

import { backendFetch } from "./backend";
import { readBoundedBody } from "./body-limit";
import { loginClientIpHeaders } from "./client-ip";
import { bffError, isSameOrigin } from "./handlers";

import type { NextRequest } from "next/server";

/** BE `CustomerOnboardingController` (d215f6e) — anonymous, rate-limited 10/min/IP. */
export const PORTAL_ACTIVATION_BACKEND_PATH = "customers/portal-activation";
/** `{ token ≤128, password ≤72 }` — vài trăm byte; giới hạn chặt để route công khai không bị lạm dụng. */
const ACTIVATION_BODY_LIMIT_BYTES = 4 * 1024;

const activationBodySchema = z.object({
  token: z.string().min(1).max(128),
  password: z.string().min(1).max(72),
});

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Kích hoạt tài khoản portal từ link mời (SCRUM-451). Route công khai DUY NHẤT tới Spring ngoài
 * login: không đọc / gửi cookie phiên, không trả token. Kết quả (200 `{email}` hoặc lỗi
 * `PORTAL_INVITATION_INVALID` / `VALIDATION_FAILED` / `RATE_LIMITED`) chuyển nguyên trạng.
 */
export async function portalActivationHandler(request: NextRequest): Promise<NextResponse> {
  if (!isSameOrigin(request)) return bffError(403, AUTH_ERROR_CODES.csrfRejected);
  const read = await readBoundedBody(request, ACTIVATION_BODY_LIMIT_BYTES);
  if (!read.ok)
    return read.reason === "too-large"
      ? bffError(413, PROXY_ERROR_CODES.payloadTooLarge)
      : bffError(400, PROXY_ERROR_CODES.malformedRequest);
  let parsed: z.infer<typeof activationBodySchema>;
  try {
    const result = activationBodySchema.safeParse(
      JSON.parse(new TextDecoder().decode(read.body)) as unknown,
    );
    if (!result.success) return bffError(400, PROXY_ERROR_CODES.malformedRequest);
    parsed = result.data;
  } catch {
    return bffError(400, PROXY_ERROR_CODES.malformedRequest);
  }
  try {
    const upstream = await backendFetch(PORTAL_ACTIVATION_BACKEND_PATH, {
      method: "POST",
      headers: {
        ...loginClientIpHeaders(request.headers),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(parsed),
    });
    const text = await upstream.text();
    // Không bao giờ phản hồi lại token mời (dù BE không trả) — chặn rò rỉ qua log/trình duyệt.
    if (text.includes(parsed.token)) return bffError(502, PROXY_ERROR_CODES.unsafeUpstreamResponse);
    return new NextResponse(text || null, {
      status: upstream.status,
      headers: { ...NO_STORE, "Content-Type": "application/json" },
    });
  } catch {
    return bffError(502, PROXY_ERROR_CODES.backendUnavailable);
  }
}
