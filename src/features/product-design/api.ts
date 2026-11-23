/**
 * API of a variant's print configuration (BE `CustomizationTemplateController`, origin/develop d47ed4ae). Every response
 * is parsed once, here.
 *
 * The BE has no "the variant's print configuration" resource: a variant has templates by code, one of them
 * active. `getPrintConfig` reads the list and returns the active template, else the first by code, else `null`
 * (BE answers 200 with `[]`; 404 is only for an unknown product or variant and is not swallowed).
 */
import { api } from "@/lib/api/client";
import { sha256Hex } from "@/lib/crypto/sha256";

import { ModelFileMismatchError } from "./errors";
import {
  designFontListSchema,
  downloadLinkSchema,
  printConfigDtoSchema,
  printConfigSaveInputSchema,
} from "./schemas";

import type { AxiosRequestConfig } from "axios";
import type {
  ModelFileBytes,
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
 * The template as BE `CustomizationTemplateRequest` takes it (the JSON body, or the multipart part `template`): areas
 * carry only name and margins (position and shape are computed by the BE), plus `model3d.surfaces`. No file and no
 * checksum field: the BE hashes the bytes it stores. `code` is create-only; `version` is update-only.
 */
export function printConfigBody(config: PrintConfigBody, stored: { version: number } | null) {
  return {
    ...(stored ? { version: stored.version } : { code: config.code }),
    name: config.name,
    minDpi: config.minDpi,
    colorMode: config.colorMode,
    allowedFileFormats: config.allowedFileFormats,
    maxFileSizeMb: config.maxFileSizeMb,
    maxColors: config.maxColors ?? undefined,
    // BE-18: no font chosen is `null` (no limit), sent as such — never left out, never `[]` (the BE refuses that).
    allowedFontCodes: config.allowedFontCodes ?? null,
    model: config.model,
    printAreas: config.printAreas,
    model3d: { surfaces: config.surfaces },
  };
}

/**
 * The shared client sends `Content-Type: application/json` by default, and axios turns a `FormData` sent under a JSON
 * content type into a JSON string. Clearing the default (not setting a multipart type by hand) keeps the `FormData`
 * as it is; the browser then writes `multipart/form-data` with its own boundary.
 */
const MULTIPART: AxiosRequestConfig = { headers: { "Content-Type": false } };

/**
 * The multipart body of a save with a file: part `template` is the JSON as a Blob typed `application/json` (the BE
 * answers 415 to a plain text part), part `file` the exact bytes that were measured.
 */
function templateForm(body: ReturnType<typeof printConfigBody>, file: ModelFileBytes): FormData {
  const form = new FormData();
  form.append("template", new Blob([JSON.stringify(body)], { type: "application/json" }));
  form.append("file", new File([file.bytes], file.name, { type: "model/gltf-binary" }));
  return form;
}

/**
 * `GET …/{templateId}/model-file/download-url`: a short-lived link to the stored `.glb` (BE `DownloadLink`). Call it
 * only for a template whose `model3d.hasFile` is true (the BE answers 404 NOT_FOUND otherwise).
 */
export async function getModelFileLink(
  productId: string,
  variantId: string,
  templateId: string,
  signal?: AbortSignal,
) {
  const url = `${templatePath(productId, variantId, templateId)}/model-file/download-url`;
  const { data } = await api.get<unknown>(url, { signal });
  return downloadLinkSchema.parse(data);
}

/**
 * `PUT …/{templateId}/reference-file?version=N`, multipart part `file` (BD-7, BE `attachReference`): attaches or replaces
 * the reference die-line (PDF or PNG, `FileCategory.PRINT_TEMPLATE` ≤ 20 MiB). Returns the template with its new
 * `version` and `referenceFileName`. Errors: 409 OPTIMISTIC_LOCK, 409 CONFLICT (product / variant no longer sold), 413,
 * 415, 400 VALIDATION_FAILED (scan, a PDF with actions / JavaScript / files / encryption), 404 PRINT_CONFIG_NOT_FOUND.
 */
export async function attachReferenceFile(target: PrintConfigTarget & { file: File }) {
  const { productId, variantId, templateId, version, file } = target;
  const form = new FormData();
  form.append("file", file);
  const url = `${templatePath(productId, variantId, templateId)}/reference-file`;
  const { data } = await api.put<unknown>(url, form, { ...MULTIPART, params: { version } });
  return printConfigDtoSchema.parse(data);
}

/** `GET …/{templateId}/reference-file/download-url` (BE `DownloadLink`): asked on each click; 404 when none is attached. */
export async function getReferenceFileLink(
  productId: string,
  variantId: string,
  templateId: string,
) {
  const url = `${templatePath(productId, variantId, templateId)}/reference-file/download-url`;
  const { data } = await api.get<unknown>(url);
  return downloadLinkSchema.parse(data);
}

/** `GET /design-fonts` (BE-18, permission `design-designs:READ`): the fonts a configuration may allow. */
export async function getDesignFonts(signal?: AbortSignal) {
  const { data } = await api.get<unknown>("/design-fonts", { signal });
  return designFontListSchema.parse(data);
}

/** One request; which one depends on what is saved. */
function sendSave(productId: string, variantId: string, input: PrintConfigSaveInput) {
  const body = printConfigBody(input.config, input.stored);
  const { stored, file } = input;
  if (!stored) {
    // `printConfigSaveInputSchema` refuses a create without a file before this point (the BE answers 409).
    if (!file) throw new Error("A print configuration is created with its model file");
    return api.post<unknown>(
      templatesPath(productId, variantId),
      templateForm(body, file),
      MULTIPART,
    );
  }
  const url = templatePath(productId, variantId, stored.templateId);
  return file
    ? api.put<unknown>(url, templateForm(body, file), MULTIPART)
    : api.put<unknown>(url, body);
}

/**
 * THE save: one request, so the template, its measurements, its area ↔ mesh table and its `.glb` are stored together
 * in one BE transaction or not at all.
 *  - create: `POST` multipart (`template` + `file`); a create always has a file;
 *  - update with a new file: `PUT …/{templateId}` multipart, `version` in `template`;
 *  - update without a file: `PUT …/{templateId}` JSON, the measured values exactly as they were read.
 * The new `version` is the response's (the BE may move it by more than one). With a file, the SHA-256 of the measured
 * bytes is computed before anything is sent (no `crypto.subtle` fails with `SecureContextRequiredError` first) and the
 * response's `model3d.fileChecksum` must be it: otherwise `ModelFileMismatchError`, not a success.
 */
export async function savePrintConfig(
  productId: string,
  variantId: string,
  rawInput: PrintConfigSaveInput,
): Promise<PrintConfigDto> {
  const input = printConfigSaveInputSchema.parse(rawInput);
  const measured = input.file ? await sha256Hex(input.file.bytes) : null;
  const { data } = await sendSave(productId, variantId, input);
  const saved = printConfigDtoSchema.parse(data);
  if (measured !== null && saved.model3d.fileChecksum !== measured) {
    throw new ModelFileMismatchError();
  }
  return saved;
}

async function changeStatus(target: PrintConfigTarget, action: "activation" | "deactivation") {
  const { productId, variantId, templateId, version } = target;
  const url = `${templatePath(productId, variantId, templateId)}/${action}`;
  const { data } = await api.post<unknown>(url, { version });
  return printConfigDtoSchema.parse(data);
}

/**
 * `POST …/{templateId}/activation`, body `{ version }` (BE, origin/develop 8c63a729). The variant's previously active
 * template is retired in the same transaction. Errors: 409 PRINT_CONFIG_MODEL_FILE_REQUIRED (no `.glb`, or a template
 * stored before models were kept, without a model: the same fix, upload the `.glb` with its measurements), 422 PRINT_CONFIG_SURFACES_INVALID (an area without its `print:<code>`
 * mesh), 409 PRODUCT_NOT_CUSTOMIZABLE, 409 CONFLICT (variant or product no longer sold), 409 OPTIMISTIC_LOCK, 404
 * PRINT_CONFIG_NOT_FOUND.
 */
export const activatePrintConfig = (target: PrintConfigTarget): Promise<PrintConfigDto> =>
  changeStatus(target, "activation");

/**
 * `POST …/{templateId}/deactivation`, body `{ version }`: no new design starts on it, drafts on it keep it. The BE
 * allows it whatever the product is doing (no PRODUCT_NOT_CUSTOMIZABLE or CONFLICT); 409 OPTIMISTIC_LOCK, 404 as above.
 */
export const deactivatePrintConfig = (target: PrintConfigTarget): Promise<PrintConfigDto> =>
  changeStatus(target, "deactivation");
