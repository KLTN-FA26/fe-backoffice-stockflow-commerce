/**
 * Mock — đọc request `POST` / `PUT customization-templates` đúng BE (origin/develop d47ed4ae):
 *  - JSON (`CustomizationTemplateRequest`), hoặc `multipart/form-data` với phần `template` (JSON, kiểu `application/json`,
 *    phần chữ thường → 415) và phần `file` (`.glb`; phần rỗng coi như không có file, như `withModelFile` của BE);
 *  - kiểm theo thứ tự của BE: bean validation (400 VALIDATION_FAILED), `version` khi sửa (400), `toDraft` (loại model
 *    lạ → 400 PRINT_CONFIG_INVALID), rồi các luật của service: vùng in thiếu/thừa hoặc lề sai (400 PRINT_CONFIG_INVALID),
 *    bảng ghép (422 PRINT_CONFIG_SURFACES_INVALID: `PrintAreaUnknown`, `PrintAreaDuplicate`, `Size`; khi có file thêm
 *    `PrintAreaMissing`, `MeshNameMismatch`), số đo đổi mà không kèm file (409 PRINT_CONFIG_MODEL_FILE_REQUIRED, so theo
 *    0,01 mm như `ModelFileRules`). Các luật viết lại ở đây, không gọi code của feature, để test bắt được lỗi của feature.
 */
import { PRINT_CONFIG_LIMITS as LIMITS } from "@/constants/numbers";
import { blobBytes } from "@/lib/crypto/blob-bytes";
import { printAreaCodeSchema } from "@/features/product-design/model3d/model-types";
import { AREAS_OF, printModelSchema } from "@/features/product-design/schemas";

import { bagFlapsFault, withBagFlaps } from "./mock-print-config-bag";
import { bodyOf, fail, text, validationFailed } from "./mock-route-utils";

import type { AxiosRequestConfig } from "axios";
import type { PrintSurface } from "@/features/product-design";
import type { MockAreaInput, MockPrintTemplate } from "./mock-print-config-store";
import type { MockResponseShape } from "./mock-route-utils";

type Model = MockPrintTemplate["model"];
type FieldError = { field: string; message: string; code?: string };

export interface MockUpload {
  name: string;
  bytes: ArrayBuffer;
}

/** The request as the controller sees it: the template JSON, and the `.glb` when the multipart carries a non-empty one. */
export interface MockTemplateRequest {
  body: Record<string, unknown>;
  upload: MockUpload | null;
}

export const isResponse = (value: unknown): value is MockResponseShape =>
  typeof value === "object" && value !== null && "status" in value;

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? Object.fromEntries(Object.entries(value)) : {};

const surfacesInvalid = (message: string, errors: FieldError[]) =>
  fail(422, "PRINT_CONFIG_SURFACES_INVALID", message, errors);

/**
 * JSON or multipart, the BE's two forms of the same endpoint (selected by `Content-Type`). A part `template` that is not
 * typed `application/json` is 415 (Spring cannot convert it); no part `template` is 400 VALIDATION_FAILED.
 */
export async function readTemplateRequest(
  config: AxiosRequestConfig,
): Promise<MockTemplateRequest | MockResponseShape> {
  const form = config.data;
  if (!(form instanceof FormData)) return { body: bodyOf(config), upload: null };
  const part = form.get("template");
  if (part === null) return validationFailed("template", "Required part 'template' is not present");
  if (!(part instanceof Blob) || !part.type.toLowerCase().startsWith("application/json")) {
    return fail(415, "UNSUPPORTED_MEDIA_TYPE", "The part template takes application/json");
  }
  let body: Record<string, unknown>;
  try {
    body = record(JSON.parse(new TextDecoder().decode(await blobBytes(part))));
  } catch {
    return validationFailed("template", "The part template is not JSON");
  }
  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) return { body, upload: null };
  const name = file instanceof File ? file.name : "blob";
  return { body, upload: { name, bytes: await blobBytes(file) } };
}

/** Bean validation of `CustomizationTemplateRequest` (`@NotBlank`, `@NotEmpty`, `@NotNull`), then `versionOf` on update. */
export function checkRequest(
  b: Record<string, unknown>,
  update: boolean,
): { code: string; version: number | null } | MockResponseShape {
  if (!text(b.name)) return validationFailed("name", "name is required");
  const formats = Array.isArray(b.allowedFileFormats) ? b.allowedFileFormats : [];
  if (formats.length === 0)
    return validationFailed("allowedFileFormats", "allowedFileFormats is required");
  if (b.maxFileSizeMb === undefined || b.maxFileSizeMb === null)
    return validationFailed("maxFileSizeMb", "maxFileSizeMb is required");
  if (!text(record(b.model).kind)) return validationFailed("model.kind", "model.kind is required");
  const areas = Array.isArray(b.printAreas) ? b.printAreas : [];
  if (areas.length === 0) return validationFailed("printAreas", "printAreas is required");
  for (const [i, raw] of areas.entries()) {
    const area = record(raw);
    if (!text(area.code)) return validationFailed(`printAreas[${i}].code`, "code is required");
    if (!text(area.name)) return validationFailed(`printAreas[${i}].name`, "name is required");
    for (const margin of ["safeMarginMm", "bleedMm"] as const) {
      if (typeof area[margin] !== "number")
        return validationFailed(`printAreas[${i}].${margin}`, `${margin} is required`);
    }
  }
  const version = typeof b.version === "number" ? b.version : null;
  if (update && version === null) return validationFailed("version", "version is required");
  return { code: text(b.code), version };
}

/**
 * `CustomizationTemplateWebMapper.toModel`: a kind the BE does not know is 400 PRINT_CONFIG_INVALID; a bag without a
 * glue flap or bottom fold takes the defaults, one out of range is refused with its field (`requireBag`).
 */
export function modelOf(b: Record<string, unknown>): Model | MockResponseShape {
  const fault = bagFlapsFault(record(b.model));
  if (fault) return fault;
  const model = printModelSchema.safeParse(b.model);
  return model.success
    ? withBagFlaps(model.data)
    : fail(400, "PRINT_CONFIG_INVALID", "The model kind is parametric-cup or parametric-bag");
}

/** `PrintConfigRules.areas`: the model's areas exactly once each, a name, margins in range. */
export function areasOf(
  b: Record<string, unknown>,
  model: Model,
): MockAreaInput[] | MockResponseShape {
  const areas: MockAreaInput[] = [];
  for (const row of Array.isArray(b.printAreas) ? b.printAreas : []) {
    const r = record(row);
    const code = printAreaCodeSchema.safeParse(r.code);
    if (!code.success) return fail(400, "PRINT_CONFIG_INVALID", "Unknown print area");
    areas.push({
      code: code.data,
      name: text(r.name),
      safeMarginMm: Number(r.safeMarginMm),
      bleedMm: Number(r.bleedMm),
    });
  }
  const expected: readonly string[] = AREAS_OF[model.kind];
  const codes: string[] = areas.map((a) => a.code);
  const bad =
    codes.length !== expected.length ||
    new Set(codes).size !== codes.length ||
    expected.some((c) => !codes.includes(c)) ||
    areas.some(
      (a) => !(a.bleedMm >= 0 && a.bleedMm <= LIMITS.bleedMaxMm) || !(a.safeMarginMm >= 0),
    );
  return bad
    ? fail(400, "PRINT_CONFIG_INVALID", "A missing or extra print area, or bad margins")
    : areas;
}

/**
 * `PrintConfigService.requireSurfaces`: `null` when the request sent no `model3d.surfaces` (an update keeps the stored
 * table, a create starts empty); each row names an area of the model, once, with a mesh of 1-100 characters (trimmed).
 */
export function surfacesOf(
  b: Record<string, unknown>,
  codes: readonly string[],
): PrintSurface[] | null | MockResponseShape {
  const list = record(b.model3d).surfaces;
  if (!Array.isArray(list)) return null;
  const seen = new Set<string>();
  const errors: FieldError[] = [];
  const surfaces: PrintSurface[] = [];
  for (const [i, row] of list.entries()) {
    const at = `model3d.surfaces[${i}]`;
    const code = printAreaCodeSchema.safeParse(record(row).printAreaCode);
    const meshName = text(record(row).meshName);
    if (!code.success || !codes.includes(code.data)) {
      errors.push({
        field: `${at}.printAreaCode`,
        message: "Not a print area of this template's model",
        code: "PrintAreaUnknown",
      });
    } else if (seen.has(code.data)) {
      errors.push({
        field: `${at}.printAreaCode`,
        message: `Print area ${code.data} is mapped twice`,
        code: "PrintAreaDuplicate",
      });
    } else {
      seen.add(code.data);
    }
    if (!meshName || meshName.length > LIMITS.meshNameMaxLength) {
      errors.push({
        field: `${at}.meshName`,
        message: "A mesh name is 1 to 100 characters",
        code: "Size",
      });
    }
    if (code.success) surfaces.push({ printAreaCode: code.data, meshName });
  }
  return errors.length > 0
    ? surfacesInvalid("The 3D model's surfaces do not match the template's print areas", errors)
    : surfaces;
}

/**
 * `ModelFileRules.incompleteSurfaces`, for a template with a file (stored or sent): every area mapped, each to the
 * mesh `print:<code>`. Rows naming an unknown area are the loose check's.
 */
export function requireComplete(
  surfaces: readonly PrintSurface[],
  codes: readonly string[],
): MockResponseShape | null {
  const errors: FieldError[] = [];
  const mapped = new Set<string>();
  surfaces.forEach(({ printAreaCode, meshName }, i) => {
    if (!codes.includes(printAreaCode)) return;
    mapped.add(printAreaCode);
    if (meshName !== `print:${printAreaCode}`) {
      errors.push({
        field: `model3d.surfaces[${i}].meshName`,
        message: `Print area ${printAreaCode} is drawn on the mesh print:${printAreaCode}`,
        code: "MeshNameMismatch",
      });
    }
  });
  for (const code of codes) {
    if (!mapped.has(code)) {
      errors.push({
        field: "model3d.surfaces",
        message: `Print area ${code} has no mesh; map it to print:${code}`,
        code: "PrintAreaMissing",
      });
    }
  }
  return errors.length > 0
    ? surfacesInvalid(
        "Every print area of a template with a 3D model is drawn on its own print:<code> mesh",
        errors,
      )
    : null;
}

const hundredths = (mm: number) => Math.round(mm * 100);

/** `ModelFileRules.changedMeasurements` + `sameSurfaces`: what a request without a file may not change. */
function changedWithoutFile(
  stored: Model | null,
  storedSurfaces: readonly PrintSurface[],
  requested: Model,
  requestedSurfaces: readonly PrintSurface[] | null,
): string[] {
  const changed: string[] = [];
  if (!stored || stored.kind !== requested.kind) {
    changed.push("model.kind");
  } else if (stored.kind === "parametric-cup" && requested.kind === "parametric-cup") {
    const keys = [
      "topDiameterMm",
      "bottomDiameterMm",
      "heightMm",
      "bandTopOffsetMm",
      "bandBottomOffsetMm",
    ] as const;
    for (const key of keys) {
      if (hundredths(stored[key]) !== hundredths(requested[key])) changed.push(`model.${key}`);
    }
  } else if (stored.kind === "parametric-bag" && requested.kind === "parametric-bag") {
    if (hundredths(stored.widthMm) !== hundredths(requested.widthMm)) changed.push("model.widthMm");
    if (hundredths(stored.gussetMm) !== hundredths(requested.gussetMm))
      changed.push("model.gussetMm");
    const printed = (m: typeof stored) => hundredths(m.heightMm) - hundredths(m.topFoldMm);
    if (printed(stored) !== printed(requested)) changed.push("model.heightMm - model.topFoldMm");
  }
  if (requestedSurfaces !== null) {
    const pairs = (list: readonly PrintSurface[]) =>
      [...new Set(list.map((s) => `${s.printAreaCode}\u0000${s.meshName.trim()}`))]
        .sort()
        .join("\n");
    if (pairs(storedSurfaces) !== pairs(requestedSurfaces)) changed.push("model3d.surfaces");
  }
  return changed;
}

/** `ModelFileRules.requireUnchangedWithoutFile`: 409 PRINT_CONFIG_MODEL_FILE_REQUIRED naming what changed. */
export function requireUnchangedWithoutFile(
  stored: Pick<MockPrintTemplate, "model" | "surfaces">,
  requested: Model,
  requestedSurfaces: readonly PrintSurface[] | null,
): MockResponseShape | null {
  const changed = changedWithoutFile(stored.model, stored.surfaces, requested, requestedSurfaces);
  return changed.length > 0
    ? fail(
        409,
        "PRINT_CONFIG_MODEL_FILE_REQUIRED",
        `These values come from the 3D model file; upload the file with them: ${changed.join(", ")}`,
      )
    : null;
}

/** The fields of the template row a request sets (`PrintConfigService.describe`). */
export function fieldsOf(b: Record<string, unknown>, model: Model, areas: MockAreaInput[]) {
  return {
    name: text(b.name),
    minDpi: Number(b.minDpi) || 300,
    colorMode: b.colorMode === "RGB" ? ("RGB" as const) : ("CMYK" as const),
    allowedFileFormats: (Array.isArray(b.allowedFileFormats) ? b.allowedFileFormats : []).map(
      String,
    ),
    maxFileSizeMb: Number(b.maxFileSizeMb),
    maxColors: typeof b.maxColors === "number" ? b.maxColors : null,
    allowedFontCodes: Array.isArray(b.allowedFontCodes) ? b.allowedFontCodes.map(String) : null,
    model,
    areas,
  };
}
