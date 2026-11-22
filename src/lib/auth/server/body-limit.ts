import "server-only";

import { uploadRequestMaxBytes } from "@/constants/upload-limits";

/**
 * Request-body bounds for the generic /api/backend/* proxy. The limit comes only from trusted
 * routing data (method + backend path), never from a browser header or Content-Type.
 *
 * Default: every JSON mutation the back-office sends is far below 1 MiB (largest: receipt lines,
 * BE `ReceiptLinesRequest.lines` @Size(max = 200) with 64-char codes; free-text fields <= 2000).
 */
export const DEFAULT_PROXY_BODY_LIMIT_BYTES = 1024 * 1024;
/**
 * File upload of a variant image: POST products/{id}/variants/{id}/media
 * (BE ProductMediaController, multipart part `file`). ProductImageProcessor rejects images above
 * FileCategory.PRODUCT_IMAGE = 10 MiB; the multipart envelope (boundary, part headers, filename)
 * adds bytes, not megabytes. Spring's global 50 MB multipart cap exists for design renders, which
 * the back-office never uploads - do not widen this or the default to match it.
 */
export const PRODUCT_IMAGE_UPLOAD_LIMIT_BYTES = uploadRequestMaxBytes("productImage");

/**
 * File upload of a print configuration's 3D model, in the same multipart request as the template: POST
 * products/{id}/variants/{id}/customization-templates and PUT …/customization-templates/{templateId}
 * (BE CustomizationTemplateController, parts `template` and `file`). FileCategory.PRINT_MODEL refuses a
 * `.glb` above 10 MiB; the template part (a few KiB of JSON) and the multipart envelope fit in the
 * same 64 KiB margin.
 */
export const PRINT_MODEL_UPLOAD_LIMIT_BYTES = uploadRequestMaxBytes("printModel");

/**
 * A print configuration's reference die-line: PUT products/{id}/variants/{id}/customization-templates/{templateId}/
 * reference-file?version=N (BE CustomizationTemplateController.attachReference, multipart `file`).
 * FileCategory.PRINT_TEMPLATE = 20 MiB, PDF or PNG.
 */
export const PRINT_REFERENCE_UPLOAD_LIMIT_BYTES = uploadRequestMaxBytes("printReference");

/**
 * The signed contract scan: POST orders/{id}/contract/signature (BE SalesContractController, multipart `file`,
 * `version`, `signedOn`). Stored as FileCategory.DOCUMENT = 25 MiB; a phone or office scan is 1-5 MB, far above
 * the JSON default (WF-02 audit, item 2).
 */
export const SIGNED_CONTRACT_UPLOAD_LIMIT_BYTES = uploadRequestMaxBytes("signedContract");

/** A file sent in a chat: POST chat/conversations/{id}/attachments (BE StaffChatController), FileCategory.CHAT_ATTACHMENT = 20 MiB. */
export const CHAT_ATTACHMENT_UPLOAD_LIMIT_BYTES = uploadRequestMaxBytes("chatAttachment");

/** The signed agreement of an invoice correction: PUT einvoices/{id}/agreement, FileCategory.EINVOICE = 10 MiB. */
export const EINVOICE_AGREEMENT_UPLOAD_LIMIT_BYTES = uploadRequestMaxBytes("einvoiceAgreement");

/** A waybill CSV: POST fulfillment/waybill-imports and …/preview, FileCategory.WAYBILL_IMPORT = 2 MiB. */
export const WAYBILL_IMPORT_UPLOAD_LIMIT_BYTES = uploadRequestMaxBytes("waybillImport");

type Paths = readonly string[];

const isVariantPath = (paths: Paths) => paths[0] === "products" && paths[2] === "variants";

/**
 * Every multipart route of the back office with the BE's own file limit. Matched on method + exact segment
 * shape only; a route not listed here gets the JSON default.
 */
const UPLOAD_ROUTES: ReadonlyArray<{
  readonly matches: (method: string, paths: Paths) => boolean;
  readonly limit: number;
}> = [
  {
    matches: (method, paths) =>
      method === "POST" && paths.length === 5 && isVariantPath(paths) && paths[4] === "media",
    limit: PRODUCT_IMAGE_UPLOAD_LIMIT_BYTES,
  },
  {
    matches: (method, paths) =>
      isVariantPath(paths) &&
      paths[4] === "customization-templates" &&
      ((method === "POST" && paths.length === 5) || (method === "PUT" && paths.length === 6)),
    limit: PRINT_MODEL_UPLOAD_LIMIT_BYTES,
  },
  {
    matches: (method, paths) =>
      method === "PUT" &&
      paths.length === 7 &&
      isVariantPath(paths) &&
      paths[4] === "customization-templates" &&
      paths[6] === "reference-file",
    limit: PRINT_REFERENCE_UPLOAD_LIMIT_BYTES,
  },
  {
    matches: (method, paths) =>
      method === "POST" &&
      paths.length === 4 &&
      paths[0] === "orders" &&
      paths[2] === "contract" &&
      paths[3] === "signature",
    limit: SIGNED_CONTRACT_UPLOAD_LIMIT_BYTES,
  },
  {
    matches: (method, paths) =>
      method === "POST" &&
      paths.length === 4 &&
      paths[0] === "chat" &&
      paths[1] === "conversations" &&
      paths[3] === "attachments",
    limit: CHAT_ATTACHMENT_UPLOAD_LIMIT_BYTES,
  },
  {
    matches: (method, paths) =>
      method === "PUT" &&
      paths.length === 3 &&
      paths[0] === "einvoices" &&
      paths[2] === "agreement",
    limit: EINVOICE_AGREEMENT_UPLOAD_LIMIT_BYTES,
  },
  {
    matches: (method, paths) =>
      method === "POST" &&
      paths[0] === "fulfillment" &&
      paths[1] === "waybill-imports" &&
      (paths.length === 2 || (paths.length === 3 && paths[2] === "preview")),
    limit: WAYBILL_IMPORT_UPLOAD_LIMIT_BYTES,
  },
];

/** `paths` are the already validated proxy segments (handlers.ts rejects unsafe ones first). */
export function requestBodyLimit(method: string, paths: Paths): number {
  return (
    UPLOAD_ROUTES.find((route) => route.matches(method, paths))?.limit ??
    DEFAULT_PROXY_BODY_LIMIT_BYTES
  );
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
