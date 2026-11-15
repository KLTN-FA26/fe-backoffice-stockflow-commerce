/**
 * Mock — đọc request lưu cấu hình in. ASSUMPTION (yêu cầu BE B-1, B-6): một request `multipart/form-data` mang phần
 * JSON `template` (thân `CustomizationTemplateRequest` cộng `model3d.surfaces` và `modelFileChecksum`) và, khi có,
 * phần `file` (.glb). Luật kiểm theo BE: vùng in thiếu/thừa hoặc lề sai → 400 PRINT_CONFIG_INVALID; bảng ghép vùng in ↔
 * mesh sai → 422 VALIDATION_FAILED có field error (ASSUMPTION B-2: BE chưa nêu mã lỗi này).
 */
import { PRINT_CONFIG_LIMITS as LIMITS } from "@/constants/numbers";
import { AREAS_OF, printModelSchema } from "@/features/product-design/schemas";
import { printAreaCodeSchema } from "@/features/product-design/model3d/model-types";
import { blobBytes } from "@/lib/crypto/blob-bytes";

import { fail, text, validationFailed } from "./mock-route-utils";

import type { AxiosRequestConfig } from "axios";
import type { PrintSurface } from "@/features/product-design";
import type { MockAreaInput, MockPrintTemplate } from "./mock-print-config-store";
import type { MockResponseShape } from "./mock-route-utils";

export interface MockUpload {
  name: string;
  bytes: ArrayBuffer;
}

export interface MockDraft {
  fields: Pick<
    MockPrintTemplate,
    | "name"
    | "minDpi"
    | "colorMode"
    | "allowedFileFormats"
    | "maxFileSizeMb"
    | "maxColors"
    | "allowedFontCodes"
    | "model"
    | "areas"
    | "surfaces"
  >;
  code: string;
  version: number | null;
  /** The checksum the request declares for its model file (B-6); `null` when absent. */
  checksum: string | null;
  upload: MockUpload | null;
}

export const isResponse = (value: unknown): value is MockResponseShape =>
  typeof value === "object" && value !== null && "status" in value;

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? Object.fromEntries(Object.entries(value)) : {};

async function readMultipart(
  config: AxiosRequestConfig,
): Promise<{ body: Record<string, unknown>; upload: MockUpload | null } | MockResponseShape> {
  const form = config.data;
  if (!(form instanceof FormData)) {
    return fail(415, "UNSUPPORTED_MEDIA_TYPE", "multipart/form-data with parts template and file");
  }
  const part = form.get("template");
  if (!(part instanceof Blob)) return validationFailed("template", "template part is required");
  let body: Record<string, unknown>;
  try {
    body = record(JSON.parse(new TextDecoder().decode(await blobBytes(part))));
  } catch {
    return validationFailed("template", "template part is not JSON");
  }
  const file = form.get("file");
  const upload = file instanceof File ? { name: file.name, bytes: await blobBytes(file) } : null;
  return { body, upload };
}

function surfacesOf(raw: unknown, codes: readonly string[]): PrintSurface[] | MockResponseShape {
  const list = record(raw).surfaces;
  const rows = Array.isArray(list) ? list : [];
  const seen = new Set<string>();
  const surfaces: PrintSurface[] = [];
  for (const [i, row] of rows.entries()) {
    const code = printAreaCodeSchema.safeParse(record(row).printAreaCode);
    const meshName = text(record(row).meshName);
    if (
      !code.success ||
      !codes.includes(code.data) ||
      seen.has(code.data) ||
      !meshName ||
      meshName.length > LIMITS.meshNameMaxLength
    ) {
      return fail(422, "VALIDATION_FAILED", "Invalid model3d.surfaces", [
        {
          field: `model3d.surfaces[${i}]`,
          message: "Unknown or repeated print area, or bad mesh name",
        },
      ]);
    }
    seen.add(code.data);
    surfaces.push({ printAreaCode: code.data, meshName });
  }
  return surfaces;
}

function areasOf(raw: unknown): MockAreaInput[] | null {
  const areas: MockAreaInput[] = [];
  for (const row of Array.isArray(raw) ? raw : []) {
    const r = record(row);
    const code = printAreaCodeSchema.safeParse(r.code);
    if (!code.success) return null;
    areas.push({
      code: code.data,
      name: text(r.name),
      safeMarginMm: Number(r.safeMarginMm),
      bleedMm: Number(r.bleedMm),
    });
  }
  return areas;
}

export async function readDraft(
  config: AxiosRequestConfig,
): Promise<MockDraft | MockResponseShape> {
  const request = await readMultipart(config);
  if (isResponse(request)) return request;
  const { body: b, upload } = request;
  const model = printModelSchema.safeParse(b.model);
  if (!text(b.name)) return validationFailed("name", "name is required");
  if (!model.success) return validationFailed("model", "model is required");
  const formats = Array.isArray(b.allowedFileFormats) ? b.allowedFileFormats.map(String) : [];
  if (formats.length === 0)
    return validationFailed("allowedFileFormats", "allowedFileFormats is required");
  const [minSize, maxSize] = LIMITS.maxFileSizeMbRange;
  const size = Number(b.maxFileSizeMb);
  if (!Number.isInteger(size) || size < minSize || size > maxSize)
    return validationFailed("maxFileSizeMb", `maxFileSizeMb must be ${minSize}-${maxSize}`);
  const areas = areasOf(b.printAreas);
  const expected: readonly string[] = AREAS_OF[model.data.kind];
  const codes: string[] = (areas ?? []).map((a) => a.code);
  if (
    !areas ||
    codes.length !== expected.length ||
    new Set(codes).size !== codes.length ||
    expected.some((c) => !codes.includes(c)) ||
    areas.some(
      (a) =>
        !a.name || !(a.bleedMm >= 0 && a.bleedMm <= LIMITS.bleedMaxMm) || !(a.safeMarginMm >= 0),
    )
  ) {
    return fail(400, "PRINT_CONFIG_INVALID", "A missing or extra print area, or bad margins");
  }
  const surfaces = surfacesOf(b.model3d, codes);
  if (isResponse(surfaces)) return surfaces;
  return {
    code: text(b.code),
    version: typeof b.version === "number" ? b.version : null,
    checksum: typeof b.modelFileChecksum === "string" ? b.modelFileChecksum : null,
    upload,
    fields: {
      name: text(b.name),
      minDpi: Number(b.minDpi) || 300,
      colorMode: b.colorMode === "RGB" ? "RGB" : "CMYK",
      allowedFileFormats: formats,
      maxFileSizeMb: size,
      maxColors: typeof b.maxColors === "number" ? b.maxColors : null,
      allowedFontCodes: Array.isArray(b.allowedFontCodes) ? b.allowedFontCodes.map(String) : null,
      model: model.data,
      areas,
      surfaces,
    },
  };
}
