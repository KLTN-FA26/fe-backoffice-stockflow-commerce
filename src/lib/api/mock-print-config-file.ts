/**
 * Mock — the `.glb` that arrives with a save, as it will be stored (BE B-1: at most 10 MB, `.glb` only).
 */
import { PRINT_CONFIG_LIMITS as LIMITS } from "@/constants/numbers";
import { sha256Hex } from "@/lib/crypto/sha256";

import { MAX_MODEL_FILE_BYTES } from "./mock-print-config-store";
import { fail } from "./mock-route-utils";

import type { MockUpload } from "./mock-print-config-parse";
import type { MockModelFile } from "./mock-print-config-store";
import type { MockResponseShape } from "./mock-route-utils";

/**
 * The file that arrived with the request, as it will be stored. The checksum is computed from its bytes.
 * ASSUMPTION (yêu cầu BE B-6; the code is our name, the BE has not named it): a checksum the request declares must
 * equal the file's, else 422 MODEL_FILE_CHECKSUM_MISMATCH. 413 over 10 MB and 415 not `.glb` as B-1 says.
 */
export async function storedFile(
  upload: MockUpload,
  declared: string | null,
  templateId: string,
): Promise<MockModelFile | MockResponseShape> {
  if (!upload.name.toLowerCase().endsWith(LIMITS.modelFileExtension))
    return fail(415, "UNSUPPORTED_MEDIA_TYPE", "Only .glb");
  if (upload.bytes.byteLength > MAX_MODEL_FILE_BYTES)
    return fail(413, "PAYLOAD_TOO_LARGE", "File too large");
  const checksum = await sha256Hex(upload.bytes);
  if (declared !== null && declared !== checksum) {
    return fail(
      422,
      "MODEL_FILE_CHECKSUM_MISMATCH",
      "The file is not the one the figures were measured on",
    );
  }
  const url =
    typeof URL.createObjectURL === "function"
      ? URL.createObjectURL(new Blob([upload.bytes], { type: "model/gltf-binary" }))
      : `mock-model://${templateId}/${upload.name}`;
  return { url, name: upload.name, sizeBytes: upload.bytes.byteLength, checksum };
}
