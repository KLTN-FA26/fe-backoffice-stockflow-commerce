/**
 * Mock routes — cấu hình in của biến thể, đúng hợp đồng BE `CustomizationTemplateController` (origin/develop d47ed4ae):
 *  - `GET …/customization-templates`, `GET …/{templateId}`;
 *  - `POST …/customization-templates`: multipart, phần `template` (JSON `application/json`) và phần `file` (`.glb`) bắt
 *    buộc; JSON hoặc multipart không có file → 409 PRINT_CONFIG_MODEL_FILE_REQUIRED;
 *  - `PUT …/{templateId}`: multipart (`template` có `version`, `file` không bắt buộc) hoặc JSON (không file). Không kèm
 *    file thì số đo (so theo 0,01 mm), loại model và bảng ghép phải giữ nguyên (409 PRINT_CONFIG_MODEL_FILE_REQUIRED);
 *    có file (đã lưu hoặc gửi kèm) thì mỗi vùng in đúng một dòng ghép, mesh `print:<mã>` (422);
 *  - `PUT …/{templateId}/model-file`: đã bỏ → 404 NOT_FOUND, như BE;
 *  - `GET …/{templateId}/model-file/download-url` → `{ url, expiresAt }`;
 *  - `POST …/{templateId}/activation|deactivation` (body `{ version }`); kích hoạt cần file (409) và bảng ghép đủ (422).
 * Một lần lưu là một transaction: hỏng thì kho không đổi. `version` có thể tăng hơn 1 (BE khoá
 * `PESSIMISTIC_FORCE_INCREMENT` rồi ghi dòng template). Mọi thành công bọc `{ success: true, data }`, mọi lỗi theo
 * `ApiResponse` của BE, để interceptor của client chạy thật.
 */
import { PRINT_CONFIG_LIMITS as LIMITS } from "@/constants/numbers";

import { registerMockRoute } from "./mock-adapter";
import { storedFile } from "./mock-print-config-file";
import {
  areasOf,
  checkRequest,
  fieldsOf,
  isResponse,
  modelOf,
  readTemplateRequest,
  requireComplete,
  requireUnchangedWithoutFile,
  surfacesOf,
} from "./mock-print-config-parse";
import { nextTemplateId, responseOf, saveTemplate, templatesOf } from "./mock-print-config-store";
import { findMockProduct } from "./mock-product-store";
import { bodyOf, fail, ok, pathParams, validationFailed } from "./mock-route-utils";
import { findMockVariant } from "./mock-routes-variants";

import type { AxiosRequestConfig } from "axios";
import type { MockModelFile, MockPrintTemplate } from "./mock-print-config-store";
import type { MockResponseShape } from "./mock-route-utils";

export { printConfigMockFaults, resetPrintConfigMockStore } from "./mock-print-config-store";

/**
 * Every BE handler answers `ApiResponse.ok(...)`: `{ success: true, data }` (null fields omitted, like the BE's
 * `non_null`), and every refusal `{ success: false, errorCode, message, fieldErrors }` (`fail`).
 */
const wrapped = (data: unknown, status = 200): MockResponseShape =>
  ok({ success: true, data }, status);

/** BE `FileTransfers` links last minutes; the mock's says so with a real timestamp. */
const LINK_LIFETIME_MS = 15 * 60 * 1000;

type Target = {
  productId: string;
  variantId: string;
  sku: string;
  writable: boolean;
};

/**
 * BE order for a write (`lockCustomizable`, `variantOf`, `requireWritable`): the product, then its kind, then the
 * variant. A read looks at the product and the variant only.
 */
async function targetOf(
  config: AxiosRequestConfig,
  write: boolean,
): Promise<Target | MockResponseShape> {
  const { id = "", variantId = "" } = pathParams(config);
  const product = await findMockProduct(id);
  if (!product) return fail(404, "PRODUCT_NOT_FOUND", "Product not found");
  if (write && product.type !== "Customizable")
    return fail(409, "PRODUCT_NOT_CUSTOMIZABLE", "Product is not customizable");
  const variant = await findMockVariant(id, variantId);
  if (!variant) return fail(404, "VARIANT_NOT_FOUND", "Variant not found");
  return {
    productId: id,
    variantId,
    sku: variant.sku,
    writable: product.status !== "Discontinued" && variant.status !== "OBSOLETE",
  };
}

/** Ghi: sản phẩm và biến thể còn bán (409 CONFLICT, BE `requireWritable`); loại sản phẩm đã kiểm ở `targetOf`. */
async function writableTarget(config: AxiosRequestConfig): Promise<Target | MockResponseShape> {
  const t = await targetOf(config, true);
  if (isResponse(t)) return t;
  return t.writable ? t : fail(409, "CONFLICT", "Variant is no longer sold");
}

function findTemplate(t: Target, templateId: string) {
  const found = templatesOf(t.variantId).find((x) => x.templateId === templateId);
  return found ?? fail(404, "PRINT_CONFIG_NOT_FOUND", "Template not found");
}

function lockOf(t: Target, templateId: string, version: number) {
  const found = findTemplate(t, templateId);
  if (isResponse(found)) return found;
  return version === found.version
    ? found
    : fail(409, "OPTIMISTIC_LOCK", "The template changed meanwhile");
}

/** `PrintConfigRules.requireValid` of the limits (`describe`): 400 PRINT_CONFIG_INVALID. */
function limitsInvalid(fields: ReturnType<typeof fieldsOf>): MockResponseShape | null {
  const [minSize, maxSize] = LIMITS.maxFileSizeMbRange;
  const [minDpi, maxDpi] = LIMITS.minDpiRange;
  const size = fields.maxFileSizeMb;
  const valid =
    Number.isInteger(size) &&
    size >= minSize &&
    size <= maxSize &&
    fields.minDpi >= minDpi &&
    fields.minDpi <= maxDpi;
  return valid ? null : fail(400, "PRINT_CONFIG_INVALID", "Limits out of range");
}

/** BE `create`: the request, then the draft and the file (no lock held), then the product and the code, in one go. */
async function createTemplate(config: AxiosRequestConfig): Promise<MockResponseShape> {
  const request = await readTemplateRequest(config);
  if (isResponse(request)) return request;
  const { body, upload } = request;
  const head = checkRequest(body, false);
  if (isResponse(head)) return head;
  const model = modelOf(body);
  if (isResponse(model)) return model;
  if (!upload) {
    return fail(
      409,
      "PRINT_CONFIG_MODEL_FILE_REQUIRED",
      "A template is created together with its 3D model file (.glb)",
    );
  }
  const areas = areasOf(body, model);
  if (isResponse(areas)) return areas;
  const file = await storedFile(upload, "new");
  if (isResponse(file)) return file;
  const t = await writableTarget(config);
  if (isResponse(t)) return t;
  if (!LIMITS.codePattern.test(head.code))
    return fail(
      400,
      "PRINT_CONFIG_INVALID",
      "A template code is 1 to 50 capital letters, digits or hyphens",
    );
  if (templatesOf(t.variantId).some((x) => x.code === head.code))
    return fail(409, "PRINT_CONFIG_CODE_TAKEN", "Code taken");
  const codes = areas.map((a) => a.code);
  const surfaces = surfacesOf(body, codes);
  if (isResponse(surfaces)) return surfaces;
  const incomplete = requireComplete(surfaces ?? [], codes);
  if (incomplete) return incomplete;
  const fields = fieldsOf(body, model, areas);
  const invalid = limitsInvalid(fields);
  if (invalid) return invalid;
  const created: MockPrintTemplate = {
    ...fields,
    templateId: nextTemplateId(),
    productId: t.productId,
    variantId: t.variantId,
    sku: t.sku,
    code: head.code,
    active: false,
    surfaces: surfaces ?? [],
    file,
    version: 0,
  };
  saveTemplate(created);
  return wrapped(responseOf(created), 201);
}

/** What the template row holds (not its areas, which live in rows of their own). */
const rowOf = (t: MockPrintTemplate) =>
  JSON.stringify([
    t.name,
    t.minDpi,
    t.colorMode,
    t.allowedFileFormats,
    t.maxFileSizeMb,
    t.maxColors,
    t.allowedFontCodes,
    t.model,
    t.surfaces,
    t.file?.checksum ?? null,
    t.file?.name ?? null,
  ]);

/**
 * BE `update`: `version` and the draft first; with a file, the file is checked before any lock. Then the lock, the
 * table, the rules of a save without a file (`ModelFileRules`) or with one (complete table), all or nothing.
 */
async function updateTemplate(config: AxiosRequestConfig): Promise<MockResponseShape> {
  const request = await readTemplateRequest(config);
  if (isResponse(request)) return request;
  const { body, upload } = request;
  const head = checkRequest(body, true);
  if (isResponse(head)) return head;
  const model = modelOf(body);
  if (isResponse(model)) return model;
  const templateId = pathParams(config).templateId ?? "";
  let file: MockModelFile | null = null;
  if (upload) {
    const areas = areasOf(body, model);
    if (isResponse(areas)) return areas;
    const checked = await storedFile(upload, templateId);
    if (isResponse(checked)) return checked;
    file = checked;
  }
  const t = await writableTarget(config);
  if (isResponse(t)) return t;
  const stored = lockOf(t, templateId, head.version ?? -1);
  if (isResponse(stored)) return stored;
  const areas = areasOf(body, model);
  if (isResponse(areas)) return areas;
  const codes: string[] = areas.map((a) => a.code);
  const requested = surfacesOf(body, codes);
  if (isResponse(requested)) return requested;
  if (!file) {
    const refused = requireUnchangedWithoutFile(stored, model, requested);
    if (refused) return refused;
  }
  // BE `keptSurfaces`: no table sent keeps the stored rows whose area the model still has.
  const surfaces = requested ?? stored.surfaces.filter((s) => codes.includes(s.printAreaCode));
  if (file || stored.file) {
    const incomplete = requireComplete(surfaces, codes);
    if (incomplete) return incomplete;
  }
  const fields = fieldsOf(body, model, areas);
  const invalid = limitsInvalid(fields);
  if (invalid) return invalid;
  const next: MockPrintTemplate = { ...stored, ...fields, surfaces, file: file ?? stored.file };
  // The forced increment of the lock, and one more when the template row itself changed.
  const version = stored.version + 1 + (rowOf(next) === rowOf(stored) ? 0 : 1);
  const updated = { ...next, version };
  saveTemplate(updated);
  return wrapped(responseOf(updated));
}

/** Activation and deactivation: body `{ version }`; `activate` also needs a still-sold product, a file and a full table. */
async function changeStatus(config: AxiosRequestConfig, activate: boolean) {
  const t = activate ? await writableTarget(config) : await targetOf(config, false);
  if (isResponse(t)) return t;
  const { version } = bodyOf(config);
  if (typeof version !== "number") return validationFailed("version", "version is required");
  const stored = lockOf(t, pathParams(config).templateId ?? "", version);
  if (isResponse(stored)) return stored;
  if (activate) {
    if (!stored.file) {
      return fail(
        409,
        "PRINT_CONFIG_MODEL_FILE_REQUIRED",
        "Upload the template's 3D model file before activating it",
      );
    }
    const incomplete = requireComplete(
      stored.surfaces,
      stored.areas.map((a) => a.code),
    );
    if (incomplete) return incomplete;
  }
  if (stored.active === activate) return wrapped(responseOf(stored));
  // The version moves when the status changes (BE: `saveAndFlush` on a `@Version` entity).
  if (activate) {
    for (const other of templatesOf(t.variantId).filter((x) => x.active)) {
      saveTemplate({ ...other, active: false, version: other.version + 1 });
    }
  }
  const updated = { ...stored, active: activate, version: stored.version + 1 };
  saveTemplate(updated);
  return wrapped(responseOf(updated));
}

export function registerPrintConfigMockRoutes(): void {
  const base = "/products/:id/variants/:variantId/customization-templates";

  registerMockRoute("GET", base, async (config) => {
    const t = await targetOf(config, false);
    return isResponse(t) ? t : wrapped(templatesOf(t.variantId).map(responseOf));
  });

  registerMockRoute("GET", `${base}/:templateId`, async (config) => {
    const t = await targetOf(config, false);
    if (isResponse(t)) return t;
    const found = findTemplate(t, pathParams(config).templateId ?? "");
    return isResponse(found) ? found : wrapped(responseOf(found));
  });

  registerMockRoute("POST", base, createTemplate);
  registerMockRoute("PUT", `${base}/:templateId`, updateTemplate);

  // Gone from the BE (a file alone would leave the measurements of the file before): no handler, so 404 NOT_FOUND.
  registerMockRoute("PUT", `${base}/:templateId/model-file`, () =>
    fail(404, "NOT_FOUND", "No endpoint PUT /model-file"),
  );

  registerMockRoute("GET", `${base}/:templateId/model-file/download-url`, async (config) => {
    const t = await targetOf(config, false);
    if (isResponse(t)) return t;
    const found = findTemplate(t, pathParams(config).templateId ?? "");
    if (isResponse(found)) return found;
    if (!found.file) return fail(404, "NOT_FOUND", "The template has no 3D model file");
    return wrapped({
      url: found.file.url,
      expiresAt: new Date(Date.now() + LINK_LIFETIME_MS).toISOString(),
    });
  });

  registerMockRoute("POST", `${base}/:templateId/activation`, (config) =>
    changeStatus(config, true),
  );
  registerMockRoute("POST", `${base}/:templateId/deactivation`, (config) =>
    changeStatus(config, false),
  );
}
