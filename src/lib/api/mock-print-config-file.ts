/**
 * Mock — the `.glb` part `file` of a multipart save, as the BE stores it (`FileTransfers.prepare`, `FileCategory
 * .PRINT_MODEL`): at most 10 MB (413 PAYLOAD_TOO_LARGE), a glTF 2.0 binary (415 UNSUPPORTED_MEDIA_TYPE), virus-scanned
 * (400 VALIDATION_FAILED); the BE keeps the SHA-256 it computes itself of the stored bytes. The mock checks the `.glb`
 * extension where the BE checks the glTF signature, and its "scanner" refuses the EICAR test signature.
 */
import { PRINT_CONFIG_LIMITS as LIMITS } from "@/constants/numbers";
import { sha256Hex } from "@/lib/crypto/sha256";

import { MAX_MODEL_FILE_BYTES, printConfigMockFaults } from "./mock-print-config-store";
import { fail } from "./mock-route-utils";

import type { MockUpload } from "./mock-print-config-parse";
import type { MockModelFile } from "./mock-print-config-store";
import type { MockResponseShape } from "./mock-route-utils";

/** The start of the EICAR anti-virus test file: what the mock's scanner refuses. */
export const EICAR_PREFIX = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR";

function isInfected(bytes: ArrayBuffer): boolean {
  const head = new TextDecoder().decode(bytes.slice(0, 128));
  return head.startsWith(EICAR_PREFIX);
}

/** The file as it will be stored: 413 over 10 MB, 415 when not a `.glb`, 400 VALIDATION_FAILED when the scan refuses it. */
export async function storedFile(
  upload: MockUpload,
  templateId: string,
): Promise<MockModelFile | MockResponseShape> {
  if (upload.bytes.byteLength > MAX_MODEL_FILE_BYTES)
    return fail(413, "PAYLOAD_TOO_LARGE", "The uploaded file is too large");
  if (!upload.name.toLowerCase().endsWith(LIMITS.modelFileExtension))
    return fail(415, "UNSUPPORTED_MEDIA_TYPE", "This file type is not accepted");
  if (isInfected(upload.bytes))
    return fail(400, "VALIDATION_FAILED", "The uploaded file did not pass the virus scan");
  // Test hook: the server keeps other bytes than it was sent (its checksum then differs from the measured file's).
  const kept = printConfigMockFaults.storeOtherBytes
    ? new Uint8Array([...new Uint8Array(upload.bytes), 0]).buffer
    : upload.bytes;
  const url =
    typeof URL.createObjectURL === "function"
      ? URL.createObjectURL(new Blob([kept], { type: "model/gltf-binary" }))
      : `mock-model://${templateId}/${upload.name}`;
  return { url, name: upload.name, sizeBytes: kept.byteLength, checksum: await sha256Hex(kept) };
}
