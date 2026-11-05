import "server-only";

/**
 * Request-body bounds for the generic /api/backend/* proxy. The limit comes only from trusted
 * routing data (method + backend path), never from a browser header or Content-Type.
 *
 * Default: every JSON mutation the back-office sends is far below 1 MiB (largest: receipt lines,
 * BE `ReceiptLinesRequest.lines` @Size(max = 200) with 64-char codes; free-text fields <= 2000).
 */
export const DEFAULT_PROXY_BODY_LIMIT_BYTES = 1024 * 1024;
/**
 * The only file upload routed through this proxy: POST products/{id}/variants/{id}/media
 * (BE ProductMediaController, multipart part `file`). ProductImageProcessor rejects images above
 * FileCategory.PRODUCT_IMAGE = 10 MiB; the multipart envelope (boundary, part headers, filename)
 * adds bytes, not megabytes. Spring's global 50 MB multipart cap exists for design renders, which
 * the back-office never uploads - do not widen this or the default to match it.
 */
export const PRODUCT_IMAGE_UPLOAD_LIMIT_BYTES = 10 * 1024 * 1024 + 64 * 1024;

/** `paths` are the already validated proxy segments (handlers.ts rejects unsafe ones first). */
export function requestBodyLimit(method: string, paths: readonly string[]): number {
  const isVariantMediaUpload =
    method === "POST" &&
    paths.length === 5 &&
    paths[0] === "products" &&
    paths[2] === "variants" &&
    paths[4] === "media";
  return isVariantMediaUpload ? PRODUCT_IMAGE_UPLOAD_LIMIT_BYTES : DEFAULT_PROXY_BODY_LIMIT_BYTES;
}

export type BoundedBody =
  | { readonly ok: true; readonly body: Uint8Array<ArrayBuffer> }
  | { readonly ok: false; readonly reason: "too-large" | "unreadable" };

/**
 * Reads at most `limit` bytes. Content-Length is only a fast reject - it can be absent or lie -
 * so the real byte count is enforced while streaming: the reader is cancelled as soon as the
 * running total passes the limit, and an oversized body is never fully buffered. N bytes pass,
 * N + 1 do not.
 */
export async function readBoundedBody(request: Request, limit: number): Promise<BoundedBody> {
  const declared = request.headers.get("Content-Length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > limit) {
    await request.body?.cancel().catch(() => undefined);
    return { ok: false, reason: "too-large" };
  }
  if (!request.body) return { ok: true, body: new Uint8Array(0) };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, reason: "too-large" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: "unreadable" };
  } finally {
    reader.releaseLock();
  }
  // One contiguous copy of an allowed body; the chunk list is released afterwards.
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, body };
}
