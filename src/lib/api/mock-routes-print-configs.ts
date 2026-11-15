/**
 * Mock routes — cấu hình in của biến thể (BE `CustomizationTemplateController`):
 *  `GET|POST /products/{id}/variants/{variantId}/customization-templates`, `PUT …/{templateId}`,
 *  `POST …/{templateId}/activation|deactivation` (body `{ version }`).
 * ASSUMPTION (yêu cầu BE B-1, B-6): POST và PUT nhận một request multipart (phần JSON `template` và phần `file`),
 * mock áp dụng cả hai hoặc không gì cả; không có endpoint `model-file` riêng.
 * Lỗi theo BE: sản phẩm không tuỳ biến → 409 PRODUCT_NOT_CUSTOMIZABLE khi ghi (đọc trả `[]`, như
 * `PrintConfigService.list`), mã trùng 409 PRINT_CONFIG_CODE_TAKEN, version cũ 409 OPTIMISTIC_LOCK.
 * Luật B-6 (số đo và file lưu thành cặp) mock cũng giữ để màn hình thử được đường lỗi.
 */
import { PRINT_CONFIG_LIMITS as LIMITS } from "@/constants/numbers";
import { measuredChanged } from "@/features/product-design/measured";

import { registerMockRoute } from "./mock-adapter";
import { storedFile } from "./mock-print-config-file";
import { isResponse, readDraft } from "./mock-print-config-parse";
import { nextTemplateId, responseOf, saveTemplate, templatesOf } from "./mock-print-config-store";
import { findMockProduct } from "./mock-product-store";
import { bodyOf, fail, ok, pathParams, validationFailed } from "./mock-route-utils";
import { findMockVariant } from "./mock-routes-variants";

import type { AxiosRequestConfig } from "axios";
import type { MockPrintTemplate } from "./mock-print-config-store";
import type { MockResponseShape } from "./mock-route-utils";

export { resetPrintConfigMockStore } from "./mock-print-config-store";

type Target = {
  productId: string;
  variantId: string;
  sku: string;
  customizable: boolean;
  writable: boolean;
};

async function targetOf(config: AxiosRequestConfig): Promise<Target | MockResponseShape> {
  const { id = "", variantId = "" } = pathParams(config);
  const product = await findMockProduct(id);
  if (!product) return fail(404, "PRODUCT_NOT_FOUND", "Product not found");
  const variant = await findMockVariant(id, variantId);
  if (!variant) return fail(404, "VARIANT_NOT_FOUND", "Variant not found");
  return {
    productId: id,
    variantId,
    sku: variant.sku,
    customizable: product.type === "Customizable",
    writable: product.status !== "Discontinued" && variant.status !== "OBSOLETE",
  };
}

/** Ghi: sản phẩm phải tuỳ biến (409 PRODUCT_NOT_CUSTOMIZABLE) và còn bán (409 CONFLICT). */
function writeGate(t: Target): MockResponseShape | null {
  if (!t.customizable) return fail(409, "PRODUCT_NOT_CUSTOMIZABLE", "Product is not customizable");
  if (!t.writable) return fail(409, "CONFLICT", "Variant is no longer sold");
  return null;
}

function lockOf(t: Target, templateId: string, version: number | null) {
  const found = templatesOf(t.variantId).find((x) => x.templateId === templateId);
  if (!found) return fail(404, "PRINT_CONFIG_NOT_FOUND", "Template not found");
  if (version === null || version !== found.version)
    return fail(409, "OPTIMISTIC_LOCK", "The template changed meanwhile");
  return found;
}

/** Activation and deactivation: body `{ version }`; `activate` also needs a customizable, still-sold product. */
async function changeStatus(config: AxiosRequestConfig, activate: boolean) {
  const t = await targetOf(config);
  if (isResponse(t)) return t;
  const gate = activate ? writeGate(t) : null;
  if (gate) return gate;
  const { version } = bodyOf(config);
  if (typeof version !== "number") return validationFailed("version", "version is required");
  const stored = lockOf(t, pathParams(config).templateId ?? "", version);
  if (isResponse(stored)) return stored;
  if (stored.active === activate) return ok(responseOf(stored));
  // ASSUMPTION: the version moves when the status changes (the BE entity is versioned; the contract is silent).
  if (activate) {
    for (const other of templatesOf(t.variantId).filter((x) => x.active)) {
      saveTemplate({ ...other, active: false, version: other.version + 1 });
    }
  }
  const updated = { ...stored, active: activate, version: stored.version + 1 };
  saveTemplate(updated);
  return ok(responseOf(updated));
}

export function registerPrintConfigMockRoutes(): void {
  const base = "/products/:id/variants/:variantId/customization-templates";

  registerMockRoute("GET", base, async (config) => {
    const t = await targetOf(config);
    return isResponse(t) ? t : ok(templatesOf(t.variantId).map(responseOf));
  });

  registerMockRoute("POST", base, async (config) => {
    const t = await targetOf(config);
    if (isResponse(t)) return t;
    const gate = writeGate(t);
    if (gate) return gate;
    const draft = await readDraft(config);
    if (isResponse(draft)) return draft;
    if (!LIMITS.codePattern.test(draft.code))
      return fail(
        400,
        "PRINT_CONFIG_INVALID",
        "A template code is 1 to 50 capital letters, digits or hyphens",
      );
    if (templatesOf(t.variantId).some((x) => x.code === draft.code))
      return fail(409, "PRINT_CONFIG_CODE_TAKEN", "Code taken");
    const templateId = nextTemplateId();
    const file = draft.upload ? await storedFile(draft.upload, draft.checksum, templateId) : null;
    if (file && isResponse(file)) return file;
    const created: MockPrintTemplate = {
      ...draft.fields,
      templateId,
      productId: t.productId,
      variantId: t.variantId,
      sku: t.sku,
      code: draft.code,
      active: false,
      file,
      version: 0,
    };
    saveTemplate(created);
    return ok(responseOf(created), 201);
  });

  registerMockRoute("PUT", `${base}/:templateId`, async (config) => {
    const t = await targetOf(config);
    if (isResponse(t)) return t;
    const gate = writeGate(t);
    if (gate) return gate;
    const draft = await readDraft(config);
    if (isResponse(draft)) return draft;
    if (draft.version === null) return validationFailed("version", "version is required");
    const stored = lockOf(t, pathParams(config).templateId ?? "", draft.version);
    if (isResponse(stored)) return stored;
    let file = stored.file;
    if (draft.upload) {
      const next = await storedFile(draft.upload, draft.checksum, stored.templateId);
      if (isResponse(next)) return next;
      file = next;
    } else if (
      stored.file &&
      measuredChanged(stored.model, draft.fields.model) &&
      draft.checksum !== stored.file.checksum
    ) {
      // ASSUMPTION (yêu cầu BE B-6; B-6 says "409 or 422", MODEL_FILE_PAIR_REQUIRED is our name): with a file
      // stored, changed measured figures need a new file, or the stored file's checksum.
      return fail(
        409,
        "MODEL_FILE_PAIR_REQUIRED",
        "Measured figures changed without a file or its checksum",
      );
    }
    const updated = { ...stored, ...draft.fields, file, version: stored.version + 1 };
    saveTemplate(updated);
    return ok(responseOf(updated));
  });

  registerMockRoute("POST", `${base}/:templateId/activation`, (config) =>
    changeStatus(config, true),
  );
  registerMockRoute("POST", `${base}/:templateId/deactivation`, (config) =>
    changeStatus(config, false),
  );
}
