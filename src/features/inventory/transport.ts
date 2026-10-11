import { z } from "zod";

import { INVENTORY_MESSAGES } from "@/constants/inventory";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import type { AxiosRequestConfig } from "axios";

const failureEnvelope = z.object({
  success: z.literal(false),
  errorCode: z.string(),
  message: z.string().optional(),
  correlationId: z.string().optional(),
  fieldErrors: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
});

// Adapt the actual backend envelope inside this feature. Existing mock/feature
// APIs use a different unwrapped response and remain unaffected.
export async function inventoryRequest<T extends z.ZodType>(
  config: AxiosRequestConfig,
  schema: T,
): Promise<z.infer<T>> {
  const response = await api.request<unknown>({
    ...config,
    // Preserve the shared 401 token-refresh path. Other HTTP failures reach this
    // boundary intact, retaining backend errorCode/fieldErrors/correlationId.
    validateStatus: (status) => status !== 401,
  });
  if (response.status < 200 || response.status >= 300) {
    const failure = failureEnvelope.safeParse(response.data);
    if (failure.success) {
      throw new ApiError(
        response.status,
        failure.data.errorCode,
        failure.data.message ?? INVENTORY_MESSAGES.requestFailed,
        failure.data.fieldErrors
          ? Object.fromEntries(
              failure.data.fieldErrors.map((field) => [field.field, field.message]),
            )
          : undefined,
        failure.data.correlationId,
      );
    }
    throw new ApiError(
      response.status,
      `HTTP_${response.status}`,
      INVENTORY_MESSAGES.requestFailed,
    );
  }
  const envelope = z
    .object({ success: z.literal(true), data: z.unknown() })
    .safeParse(response.data);
  if (!envelope.success)
    throw new ApiError(502, "INVALID_INVENTORY_CONTRACT", INVENTORY_MESSAGES.invalidContract);
  const result = schema.safeParse(envelope.data.data);
  if (!result.success)
    throw new ApiError(502, "INVALID_INVENTORY_CONTRACT", INVENTORY_MESSAGES.invalidContract);
  return result.data;
}
