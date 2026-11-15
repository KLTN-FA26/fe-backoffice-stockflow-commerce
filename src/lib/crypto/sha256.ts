import { blobBytes } from "./blob-bytes";

/**
 * `crypto.subtle` exists only in a secure context (https, or localhost). Over plain `http://` on a LAN address it is
 * undefined; callers map this error to a message that says how to open the page.
 */
export class SecureContextRequiredError extends Error {
  constructor() {
    super("crypto.subtle is unavailable: the page is not in a secure context (https or localhost)");
    this.name = "SecureContextRequiredError";
  }
}

/** SHA-256 of the bytes as lowercase hex (the `modelFileChecksum` of a print configuration). */
export async function sha256Hex(data: Blob | ArrayBuffer): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new SecureContextRequiredError();
  const bytes = data instanceof Blob ? await blobBytes(data) : data;
  const digest = await subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
