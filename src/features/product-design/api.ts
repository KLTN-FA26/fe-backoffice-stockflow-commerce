/**
 * API of a variant's print configuration (BE `CustomizationTemplateController`, origin/develop). Every response is
 * parsed once, here.
 *
 * The BE has no "the variant's print configuration" resource: a variant has templates by code, one of them
 * active. `getPrintConfig` reads the list and returns the active template, else the first by code, else `null`
 * (BE answers 200 with `[]`; 404 is only for an unknown product or variant and is not swallowed).
 */
import { api } from "@/lib/api/client";
import { sha256Hex } from "@/lib/crypto/sha256";

import { printConfigDtoSchema, printConfigSaveInputSchema } from "./schemas";

import type {
  PrintConfigBody,
  PrintConfigDto,
  PrintConfigSaveInput,
  PrintConfigTarget,
} from "./types";

const templatesPath = (productId: string, variantId: string) =>
  `/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}/customization-templates`;

const templatePath = (productId: string, variantId: string, templateId: string) =>
  `${templatesPath(productId, variantId)}/${encodeURIComponent(templateId)}`;

export function pickPrintConfig(list: readonly PrintConfigDto[]): PrintConfigDto | null {
  return list.find((template) => template.active) ?? list[0] ?? null;
}

export async function getPrintConfig(
  productId: string,
  variantId: string,
  signal?: AbortSignal,
): Promise<PrintConfigDto | null> {
  const { data } = await api.get<unknown>(templatesPath(productId, variantId), { signal });
  if (!Array.isArray(data)) throw new Error("Print configuration list response is malformed");
  return pickPrintConfig(data.map((row) => printConfigDtoSchema.parse(row)));
}

/**
 * JSON body of the template part: BE `CustomizationTemplateRequest`, whose areas carry only name and margins
 * (position and shape are computed by the BE), plus `model3d.surfaces` (B-2) and `modelFileChecksum` (B-6).
 * `code` is create-only; `version` is update-only.
 */
export function printConfigBody(
  config: PrintConfigBody,
  modelFileChecksum: string | undefined,
  stored: { version: number } | null,
) {
  return {
    ...(stored ? { version: stored.version } : { code: config.code }),
    name: config.name,
    minDpi: config.minDpi,
    colorMode: config.colorMode,
    allowedFileFormats: config.allowedFileFormats,
    maxFileSizeMb: config.maxFileSizeMb,
    maxColors: config.maxColors ?? undefined,
    allowedFontCodes: config.allowedFontCodes ?? undefined,
    model: config.model,
    printAreas: config.printAreas,
    // ASSUMPTION (yêu cầu BE B-2): the request takes `model3d: { surfaces }`.
    model3d: { surfaces: config.surfaces },
    // ASSUMPTION (yêu cầu BE B-6): the request takes `modelFileChecksum` next to `model`.
    modelFileChecksum,
  };
}

/**
 * The multipart body of a save. ASSUMPTION (yêu cầu BE B-1, B-6): the BE takes the template and the `.glb` in ONE
 * `multipart/form-data` request, as `POST` / `PUT customization-templates`, with a JSON part `template` (the body
 * above) and, when there is a file, a part `file`. The requirements document asks for exactly this; until the BE
 * does it, the mock applies both or neither.
 */
export function printConfigForm(
  body: ReturnType<typeof printConfigBody>,
  file?: { name: string; bytes: ArrayBuffer },
): FormData {
  const form = new FormData();
  form.append("template", new Blob([JSON.stringify(body)], { type: "application/json" }));
  if (file) form.append("file", new File([file.bytes], file.name, { type: "model/gltf-binary" }));
  return form;
}

const MULTIPART = { headers: { "Content-Type": "multipart/form-data" } };

/**
 * One call, one request. `POST` (no stored template) or `PUT` (stored template, with its `version`) of the
 * multipart body above. With a file the checksum is the SHA-256 of `file.bytes`, the bytes that were measured; a
 * checksum the caller supplies counts only for a save without a file (the stored file stays). Without
 * `crypto.subtle` (page not on https or localhost) the hash fails with `SecureContextRequiredError`.
 */
export async function savePrintConfig(
  productId: string,
  variantId: string,
  rawInput: PrintConfigSaveInput,
): Promise<PrintConfigDto> {
  const input = printConfigSaveInputSchema.parse(rawInput);
  const checksum = input.file ? await sha256Hex(input.file.bytes) : input.modelFileChecksum;
  const form = printConfigForm(printConfigBody(input.config, checksum, input.stored), input.file);
  const path = templatesPath(productId, variantId);
  const { data } = input.stored
    ? await api.put<unknown>(
        templatePath(productId, variantId, input.stored.templateId),
        form,
        MULTIPART,
      )
    : await api.post<unknown>(path, form, MULTIPART);
  return printConfigDtoSchema.parse(data);
}

async function changeStatus(target: PrintConfigTarget, action: "activation" | "deactivation") {
  const { productId, variantId, templateId, version } = target;
  const url = `${templatePath(productId, variantId, templateId)}/${action}`;
  const { data } = await api.post<unknown>(url, { version });
  return printConfigDtoSchema.parse(data);
}

/**
 * `POST …/{templateId}/activation`, body `{ version }` (BE, origin/develop). The variant's previously active template
 * is retired in the same transaction. Errors: 409 PRODUCT_NOT_CUSTOMIZABLE, 409 CONFLICT (variant or product no
 * longer sold), 409 OPTIMISTIC_LOCK, 404 PRINT_CONFIG_NOT_FOUND, 400 PRINT_CONFIG_INVALID (template without a model).
 */
export const activatePrintConfig = (target: PrintConfigTarget): Promise<PrintConfigDto> =>
  changeStatus(target, "activation");

/**
 * `POST …/{templateId}/deactivation`, body `{ version }`: no new design starts on it, drafts on it keep it. The BE
 * allows it whatever the product is doing (no PRODUCT_NOT_CUSTOMIZABLE or CONFLICT); 409 OPTIMISTIC_LOCK, 404 as above.
 */
export const deactivatePrintConfig = (target: PrintConfigTarget): Promise<PrintConfigDto> =>
  changeStatus(target, "deactivation");
