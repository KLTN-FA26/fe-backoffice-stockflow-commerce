/**
 * BE error of a print configuration → Vietnamese sentence. Never shows the BE's English message.
 * ASSUMPTION (yêu cầu BE B-1, B-6): the codes `MODEL_FILE_PAIR_REQUIRED`, `MODEL_FILE_CHECKSUM_MISMATCH` and
 * `MODEL_FILE_REJECTED` are our proposal; the BE has not named them (B-6 only says 409 or 422).
 */
import { PRINT_CONFIG_ERROR_MESSAGES as MESSAGES } from "@/constants/labels-print-config";
import { ApiError } from "@/lib/api/error";
import { SecureContextRequiredError } from "@/lib/crypto/sha256";

const BY_STATUS: Readonly<Record<number, string>> = {
  403: MESSAGES.FORBIDDEN,
  413: MESSAGES.PAYLOAD_TOO_LARGE,
  415: MESSAGES.UNSUPPORTED_MEDIA_TYPE,
};

function isKnownCode(code: string): code is keyof typeof MESSAGES {
  return code !== "fallback" && code in MESSAGES;
}

export function printConfigErrorMessage(error: unknown): string {
  // The hash of the file needs `crypto.subtle`, which only a secure context (https or localhost) has.
  if (error instanceof SecureContextRequiredError) return MESSAGES.SECURE_CONTEXT_REQUIRED;
  if (!(error instanceof ApiError)) return MESSAGES.fallback;
  if (isKnownCode(error.code)) return MESSAGES[error.code];
  return BY_STATUS[error.status] ?? MESSAGES.fallback;
}
