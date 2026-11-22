/**
 * BE error of a print configuration → Vietnamese sentence, by `errorCode` (never by the BE's English `message`).
 * Codes are the BE's (`ErrorCode`, origin/develop d47ed4ae): 409 PRINT_CONFIG_MODEL_FILE_REQUIRED, 422
 * PRINT_CONFIG_SURFACES_INVALID, 415 UNSUPPORTED_MEDIA_TYPE, 413 PAYLOAD_TOO_LARGE (BE or the BFF's body limit), 400
 * VALIDATION_FAILED (a file the virus scan refuses, a refused value), 429 RATE_LIMITED (the scanner is busy), 400
 * PRINT_CONFIG_INVALID, 404 PRINT_CONFIG_NOT_FOUND / NOT_FOUND, 409 PRODUCT_NOT_CUSTOMIZABLE / PRINT_CONFIG_CODE_TAKEN /
 * OPTIMISTIC_LOCK / CONFLICT. 403, 413 and 415 also map by status for an answer without a code.
 */
import {
  PRINT_CONFIG_CONTEXT_ERROR_MESSAGES as CONTEXT_MESSAGES,
  PRINT_CONFIG_ERROR_MESSAGES as MESSAGES,
} from "@/constants/labels-print-config";
import { ApiError } from "@/lib/api/error";
import { SecureContextRequiredError } from "@/lib/crypto/sha256";

/**
 * The BE stored bytes whose SHA-256 (`model3d.fileChecksum`) is not the one of the bytes the screen measured: the save is
 * not a success, and the screen reloads the template (the mutation refetches it on any error).
 */
export class ModelFileMismatchError extends Error {
  constructor() {
    super("The stored model file is not the measured file");
    this.name = "ModelFileMismatchError";
  }
}

/** What the person was doing: one code can need other words (a file is required to create, or to activate). */
export type PrintConfigErrorContext = "create" | "update" | "activate" | "reference";

const BY_STATUS: Readonly<Record<number, string>> = {
  403: MESSAGES.FORBIDDEN,
  413: MESSAGES.PAYLOAD_TOO_LARGE,
  415: MESSAGES.UNSUPPORTED_MEDIA_TYPE,
};

function isKnownCode(code: string): code is keyof typeof MESSAGES {
  return code !== "fallback" && code in MESSAGES;
}

function contextMessage(code: string, context: PrintConfigErrorContext): string | null {
  if (context === "update") return null;
  const messages: Readonly<Record<string, string>> = CONTEXT_MESSAGES[context];
  return messages[code] ?? null;
}

export function printConfigErrorMessage(
  error: unknown,
  context: PrintConfigErrorContext = "update",
): string {
  // The hash of the file needs `crypto.subtle`, which only a secure context (https or localhost) has.
  if (error instanceof SecureContextRequiredError) return MESSAGES.SECURE_CONTEXT_REQUIRED;
  if (error instanceof ModelFileMismatchError) return MESSAGES.FILE_STORED_DIFFERENT;
  if (!(error instanceof ApiError)) return MESSAGES.fallback;
  const specific = contextMessage(error.code, context);
  if (specific) return specific;
  if (isKnownCode(error.code)) return MESSAGES[error.code];
  return BY_STATUS[error.status] ?? MESSAGES.fallback;
}
