/**
 * Mock routes — từ điển thuộc tính và bộ thuộc tính danh mục (BE PR #113 `AttributeController`,
 * `CategoryAttributeController`). Quy tắc theo `Attribute` / `CategoryAttributeService` của BE:
 * mã viết hoa theo mẫu, chỉ SELECT / MULTISELECT / COLOR có giá trị, COLOR bắt buộc có #RRGGBB,
 * sửa / xoá kèm `version`, đang được dùng thì không xoá (409 ATTRIBUTE_IN_USE).
 */

import { registerMockRoute } from "./mock-adapter";
import {
  byDictionaryOrder,
  findMockAttribute,
  isMockAttributeInUse,
  isMockValueInUse,
  mockCategoryAttributes,
  mockDictionary,
  setMockCategoryAttributes,
} from "./mock-attribute-store";
import {
  bodyOf,
  fail,
  ok,
  optimisticLock,
  pageOf,
  pathParams,
  queryOf,
  text,
  validationFailed,
} from "./mock-route-utils";

import type {
  MockAttrType,
  MockAttrValue,
  MockAttribute,
  MockCategoryAttribute,
} from "./mock-attribute-store";

const TYPES: readonly MockAttrType[] = [
  "TEXT",
  "NUMBER",
  "BOOLEAN",
  "SELECT",
  "MULTISELECT",
  "COLOR",
];
const ATTRIBUTE_CODE = /^[A-Z0-9][A-Z0-9_]{0,49}$/;
const VALUE_CODE = /^[A-Z0-9][A-Z0-9_-]{0,49}$/;
const HEX = /^#[0-9A-F]{6}$/;

const holdsValues = (type: MockAttrType) =>
  type === "SELECT" || type === "MULTISELECT" || type === "COLOR";
const canBeAxis = (type: MockAttrType) => type === "SELECT" || type === "COLOR";

const attributeNotFound = () => fail(404, "ATTRIBUTE_NOT_FOUND", "No attribute");
const valueNotFound = () => fail(404, "ATTRIBUTE_VALUE_NOT_FOUND", "No such value");

const sortValues = (attribute: MockAttribute) => ({
  ...attribute,
  values: [...attribute.values].sort(byDictionaryOrder),
});

/** Trường chung của thuộc tính (tạo / sửa), theo `AttributeDetails`. */
function readDetails(body: Record<string, unknown>) {
  const name = text(body.name);
  const unit = text(body.unit);
  if (!name || name.length > 255)
    return { error: validationFailed("name", "name must be 1-255 characters") };
  if (unit.length > 20)
    return { error: validationFailed("unit", "unit must be at most 20 characters") };
  return {
    details: {
      name,
      unit: unit || null,
      filterable: body.filterable === true,
      searchable: body.searchable === true,
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
    },
  };
}

/** Trường chung của giá trị, theo `AttributeValueDetails` + `Attribute.requireShape`. */
function readValueDetails(attribute: MockAttribute, body: Record<string, unknown>) {
  const label = text(body.label);
  if (!label || label.length > 255)
    return { error: validationFailed("label", "label must be 1-255 characters") };
  const hex = text(body.hexColor).toUpperCase() || null;
  if (attribute.dataType === "COLOR" && hex === null)
    return { error: validationFailed("hexColor", "A colour value needs a hex colour") };
  if (attribute.dataType !== "COLOR" && hex !== null)
    return { error: validationFailed("hexColor", "Only a colour value has a hex colour") };
  if (hex !== null && !HEX.test(hex))
    return { error: validationFailed("hexColor", "Hex colour must look like #RRGGBB") };
  const raw = body.valueNumber;
  const valueNumber = typeof raw === "number" ? raw : null;
  if (raw !== undefined && raw !== null && typeof raw !== "number")
    return { error: validationFailed("valueNumber", "valueNumber must be a number") };
  return {
    details: {
      label,
      hexColor: hex,
      valueNumber,
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
    },
  };
}

function versionParam(config: Parameters<typeof queryOf>[0]): number | null {
  const raw = queryOf(config).get("version");
  return raw !== null && raw !== "" && Number.isInteger(Number(raw)) ? Number(raw) : null;
}

export function registerAttributeMockRoutes(): void {
  registerMockRoute("GET", "/attributes", async (config) => {
    const query = queryOf(config);
    const q = query.get("q")?.trim().toLowerCase();
    const type = query.get("dataType");
    const active = query.get("active");
    const page = Math.max(0, Number(query.get("page")) || 0);
    const size = Math.min(200, Math.max(1, Number(query.get("size")) || 20));
    const sort = (query.get("sort") ?? "sortOrder,asc").split(",");
    let rows = [...(await mockDictionary())];
    if (q)
      rows = rows.filter(
        (a) => a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q),
      );
    if (type) rows = rows.filter((a) => a.dataType === type);
    if (active !== null) rows = rows.filter((a) => a.active === (active === "true"));
    const key = (sort[0] ?? "sortOrder") as "sortOrder" | "code" | "name";
    const direction = sort[1] === "desc" ? -1 : 1;
    rows.sort(
      (a, b) =>
        direction *
        (key === "sortOrder"
          ? a.sortOrder - b.sortOrder
          : String(a[key]).localeCompare(String(b[key]))),
    );
    return ok(pageOf(rows.map(sortValues), page, size));
  });

  registerMockRoute("GET", "/attributes/:id", async (config) => {
    const attribute = await findMockAttribute(pathParams(config).id ?? "");
    return attribute ? ok(sortValues(attribute)) : attributeNotFound();
  });

  registerMockRoute("POST", "/attributes", async (config) => {
    const body = bodyOf(config);
    const code = text(body.code).toUpperCase();
    if (!ATTRIBUTE_CODE.test(code))
      return validationFailed(
        "code",
        "Attribute code must be A-Z, 0-9 or underscore, 1-50 characters",
      );
    if (typeof body.dataType !== "string" || !TYPES.includes(body.dataType as MockAttrType))
      return validationFailed("dataType", "dataType is required");
    const read = readDetails(body);
    if (read.error) return read.error;
    const rows = await mockDictionary();
    if (rows.some((a) => a.code === code))
      return fail(409, "ATTRIBUTE_CODE_ALREADY_EXISTS", `Attribute ${code} exists`);
    const created: MockAttribute = {
      attributeId: crypto.randomUUID(),
      code,
      dataType: body.dataType as MockAttrType,
      ...read.details,
      active: true,
      version: 0,
      values: [],
    };
    rows.push(created);
    return ok(created, 201);
  });

  registerMockRoute("PUT", "/attributes/:id", async (config) => {
    const attribute = await findMockAttribute(pathParams(config).id ?? "");
    if (!attribute) return attributeNotFound();
    const body = bodyOf(config);
    if (typeof body.version !== "number") return validationFailed("version", "version is required");
    if (typeof body.active !== "boolean") return validationFailed("active", "active is required");
    const read = readDetails(body);
    if (read.error) return read.error;
    if (body.version !== attribute.version) return optimisticLock();
    Object.assign(attribute, read.details, { active: body.active, version: attribute.version + 1 });
    return ok(sortValues(attribute));
  });

  registerMockRoute("DELETE", "/attributes/:id", async (config) => {
    const attribute = await findMockAttribute(pathParams(config).id ?? "");
    if (!attribute) return attributeNotFound();
    const version = versionParam(config);
    if (version === null) return validationFailed("version", "version is required");
    if (version !== attribute.version) return optimisticLock();
    if (await isMockAttributeInUse(attribute.attributeId))
      return fail(409, "ATTRIBUTE_IN_USE", `Attribute ${attribute.code} is in use`);
    const rows = await mockDictionary();
    rows.splice(rows.indexOf(attribute), 1);
    return ok(null);
  });

  registerMockRoute("POST", "/attributes/:id/values", async (config) => {
    const attribute = await findMockAttribute(pathParams(config).id ?? "");
    if (!attribute) return attributeNotFound();
    const body = bodyOf(config);
    if (!holdsValues(attribute.dataType))
      return validationFailed(
        "attribute",
        `A ${attribute.dataType} attribute has no list of values`,
      );
    const code = text(body.code).toUpperCase();
    if (!VALUE_CODE.test(code))
      return validationFailed(
        "code",
        "Value code must be A-Z, 0-9, underscore or hyphen, 1-50 characters",
      );
    const read = readValueDetails(attribute, body);
    if (read.error) return read.error;
    if (attribute.values.some((v) => v.code === code))
      return fail(
        409,
        "ATTRIBUTE_CODE_ALREADY_EXISTS",
        `Attribute ${attribute.code} already has a value ${code}`,
      );
    const value: MockAttrValue = {
      valueId: crypto.randomUUID(),
      code,
      ...read.details,
      active: true,
      version: 0,
    };
    attribute.values.push(value);
    return ok(sortValues(attribute), 201);
  });

  registerMockRoute("PUT", "/attributes/:id/values/:valueId", async (config) => {
    const attribute = await findMockAttribute(pathParams(config).id ?? "");
    if (!attribute) return attributeNotFound();
    const value = attribute.values.find((v) => v.valueId === pathParams(config).valueId);
    if (!value) return valueNotFound();
    const body = bodyOf(config);
    if (typeof body.version !== "number") return validationFailed("version", "version is required");
    if (typeof body.active !== "boolean") return validationFailed("active", "active is required");
    if (body.version !== value.version) return optimisticLock();
    const read = readValueDetails(attribute, body);
    if (read.error) return read.error;
    Object.assign(value, read.details, { active: body.active, version: value.version + 1 });
    return ok(sortValues(attribute));
  });

  registerMockRoute("DELETE", "/attributes/:id/values/:valueId", async (config) => {
    const attribute = await findMockAttribute(pathParams(config).id ?? "");
    if (!attribute) return attributeNotFound();
    const value = attribute.values.find((v) => v.valueId === pathParams(config).valueId);
    if (!value) return valueNotFound();
    const version = versionParam(config);
    if (version === null) return validationFailed("version", "version is required");
    if (version !== value.version) return optimisticLock();
    if (await isMockValueInUse(value.valueId))
      return fail(409, "ATTRIBUTE_IN_USE", `Value ${value.valueId} is in use`);
    attribute.values.splice(attribute.values.indexOf(value), 1);
    return ok(sortValues(attribute));
  });

  /* ── Bộ thuộc tính gợi ý của danh mục ─────────────────────────────── */

  const categoryView = async (categoryId: string) => {
    const dictionary = await mockDictionary();
    return (await mockCategoryAttributes(categoryId))
      .flatMap((row) => {
        const attribute = dictionary.find((a) => a.attributeId === row.attributeId);
        return attribute
          ? [
              {
                attributeId: attribute.attributeId,
                attributeCode: attribute.code,
                attributeName: attribute.name,
                dataType: attribute.dataType,
                attributeActive: attribute.active,
                defaultRole: row.defaultRole,
                required: row.required,
                sortOrder: row.sortOrder,
              },
            ]
          : [];
      })
      .sort((a, b) => a.sortOrder - b.sortOrder || a.attributeCode.localeCompare(b.attributeCode));
  };

  const categoryExists = async (categoryId: string) => {
    const { categories } = await import("@/lib/mock-data");
    return categories.some((c) => c.categoryId === categoryId);
  };

  registerMockRoute("GET", "/categories/:id/attributes", async (config) => {
    const id = pathParams(config).id ?? "";
    if (!(await categoryExists(id))) return fail(404, "CATEGORY_NOT_FOUND", `No category ${id}`);
    return ok(await categoryView(id));
  });

  registerMockRoute("PUT", "/categories/:id/attributes", async (config) => {
    const id = pathParams(config).id ?? "";
    if (!(await categoryExists(id))) return fail(404, "CATEGORY_NOT_FOUND", `No category ${id}`);
    const entries = bodyOf(config).attributes;
    if (!Array.isArray(entries)) return validationFailed("attributes", "attributes is required");
    const previous = await mockCategoryAttributes(id);
    const dictionary = await mockDictionary();
    const seen = new Set<string>();
    const rows: MockCategoryAttribute[] = [];
    for (const raw of entries as Record<string, unknown>[]) {
      const attributeId = text(raw?.attributeId);
      const role = raw?.defaultRole;
      if (!attributeId) return validationFailed("attributeId", "attributeId is required");
      if (role !== "VARIANT_AXIS" && role !== "DESCRIPTIVE")
        return validationFailed("defaultRole", "defaultRole is required");
      if (seen.has(attributeId))
        return validationFailed("attributes", `Attribute ${attributeId} is listed more than once`);
      seen.add(attributeId);
      const attribute = dictionary.find((a) => a.attributeId === attributeId);
      if (!attribute) return fail(404, "ATTRIBUTE_NOT_FOUND", `No attribute ${attributeId}`);
      if (role === "VARIANT_AXIS" && !canBeAxis(attribute.dataType))
        return validationFailed(
          "defaultRole",
          `Attribute ${attribute.code} cannot be a variant axis`,
        );
      // Một thuộc tính đã ngừng dùng được giữ nếu đã có trong bộ, nhưng không thêm mới.
      if (!attribute.active && !previous.some((p) => p.attributeId === attributeId))
        return validationFailed(
          "attributeId",
          `Attribute ${attribute.code} is inactive and cannot be added`,
        );
      rows.push({
        attributeId,
        defaultRole: role,
        required: raw.required === true,
        sortOrder: typeof raw.sortOrder === "number" ? raw.sortOrder : 0,
      });
    }
    await setMockCategoryAttributes(id, rows);
    return ok(await categoryView(id));
  });
}
