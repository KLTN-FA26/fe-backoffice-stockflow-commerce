/**
 * Mock routes — trục biến thể và thuộc tính mô tả của sản phẩm (BE PR #114
 * `ProductAttributeController`). Quy tắc theo `ProductAttributeSet` của BE:
 *  - sản phẩm chờ duyệt / đã ngừng kinh doanh không nhận thay đổi;
 *  - thêm / gỡ TRỤC chỉ khi sản phẩm còn Nháp (409 PRODUCT_AXES_LOCKED), và không thêm trục mới được
 *    nữa khi đã có biến thể mang tuỳ chọn; thêm / bớt giá trị của trục đã có thì mở;
 *  - giá trị còn được biến thể dùng thì không gỡ được (409 ATTRIBUTE_IN_USE);
 *  - trục phải là SELECT / COLOR; một thuộc tính chỉ một vai trò (trục hoặc mô tả) trên một sản phẩm.
 */

import { registerMockRoute } from "./mock-adapter";
import {
  byDictionaryOrder,
  mockAxesOf,
  mockDescriptivesOf,
  mockDictionary,
  setMockAxes,
  setMockDescriptives,
} from "./mock-attribute-store";
import { recordMockHistory } from "./mock-product-history";
import { findMockProduct, mockProductAcceptsChanges } from "./mock-product-store";
import { bodyOf, fail, ok, pathParams, validationFailed } from "./mock-route-utils";
import { mockVariantsOf } from "./mock-routes-variants";

import type { MockAttribute, MockAxisRow, MockDescriptiveRow } from "./mock-attribute-store";

const productNotFound = () => fail(404, "PRODUCT_NOT_FOUND", "Product not found");

/** BE `ProductAttributeService#view`: trục (kèm giá trị theo thứ tự từ điển) và thuộc tính mô tả. */
async function viewOf(productId: string) {
  const dictionary = await mockDictionary();
  const used = new Set(
    (await mockVariantsOf(productId)).flatMap((v) => v.options.map((o) => o.valueId)),
  );
  const attributeOf = (id: string) => dictionary.find((a) => a.attributeId === id);
  const axes = (await mockAxesOf(productId)).flatMap((row) => {
    const attribute = attributeOf(row.attributeId);
    if (!attribute) return [];
    return [
      {
        attributeId: attribute.attributeId,
        code: attribute.code,
        name: attribute.name,
        dataType: attribute.dataType,
        sortOrder: row.sortOrder,
        options: attribute.values
          .filter((v) => row.optionValueIds.includes(v.valueId))
          .sort(byDictionaryOrder)
          .map((v) => ({
            valueId: v.valueId,
            code: v.code,
            label: v.label,
            hexColor: v.hexColor,
            valueNumber: v.valueNumber,
            active: v.active,
            usedByVariant: used.has(v.valueId),
          })),
      },
    ];
  });
  const descriptives = (await mockDescriptivesOf(productId)).flatMap((row) => {
    const attribute = attributeOf(row.attributeId);
    if (!attribute) return [];
    return [
      {
        attributeId: attribute.attributeId,
        code: attribute.code,
        name: attribute.name,
        dataType: attribute.dataType,
        unit: attribute.unit,
        sortOrder: row.sortOrder,
        values: attribute.values
          .filter((v) => row.valueIds.includes(v.valueId))
          .map((v) => ({ valueId: v.valueId, code: v.code, label: v.label, active: v.active })),
        text: row.text,
        number: row.number,
        bool: row.bool,
      },
    ];
  });
  return { productId, axes, descriptives };
}

const invalid = (message: string, field = "attributes") => validationFailed(field, message);

/** Giá trị mới được thêm phải thuộc thuộc tính và còn dùng; giá trị đã có thì không hỏi lại. */
function requireNewValue(attribute: MockAttribute, valueId: string) {
  const value = attribute.values.find((v) => v.valueId === valueId);
  if (!value) return invalid(`Value ${valueId} does not belong to attribute ${attribute.code}`);
  if (!value.active)
    return invalid(
      `Value ${value.code} of attribute ${attribute.code} is inactive and cannot be newly added`,
    );
  return null;
}

export function registerProductAttributeMockRoutes(): void {
  registerMockRoute("GET", "/products/:id/attributes", async (config) => {
    const id = pathParams(config).id ?? "";
    if (!(await findMockProduct(id))) return productNotFound();
    return ok(await viewOf(id));
  });

  registerMockRoute("PUT", "/products/:id/axes", async (config) => {
    const id = pathParams(config).id ?? "";
    const product = await findMockProduct(id);
    if (!product) return productNotFound();
    const specs = bodyOf(config).axes;
    if (!Array.isArray(specs)) return validationFailed("axes", "axes is required");
    for (const spec of specs as Record<string, unknown>[]) {
      if (!Array.isArray(spec?.optionValueIds) || spec.optionValueIds.length === 0)
        return validationFailed("axes", "an axis needs at least one option");
    }
    if (!mockProductAcceptsChanges(product)) {
      return fail(
        409,
        "INVALID_PRODUCT_STATUS_TRANSITION",
        `Product ${id} is ${product.status} and accepts no change`,
      );
    }
    const dictionary = await mockDictionary();
    const before = await mockAxesOf(id);
    const descriptives = await mockDescriptivesOf(id);
    const rows: MockAxisRow[] = [];
    const seen = new Set<string>();
    for (const [index, raw] of (specs as Record<string, unknown>[]).entries()) {
      const attribute = dictionary.find((a) => a.attributeId === raw.attributeId);
      if (!attribute)
        return fail(404, "ATTRIBUTE_NOT_FOUND", `Attribute ${String(raw.attributeId)} not found`);
      if (seen.has(attribute.attributeId))
        return invalid(`Attribute ${attribute.code} appears twice among the axes`, "axes");
      seen.add(attribute.attributeId);
      if (descriptives.some((d) => d.attributeId === attribute.attributeId))
        return invalid(
          `Attribute ${attribute.code} is a descriptive attribute of this product; remove it from there first`,
          "axes",
        );
      if (attribute.dataType !== "SELECT" && attribute.dataType !== "COLOR")
        return invalid(
          `A ${attribute.dataType} attribute (${attribute.code}) cannot be a variant axis`,
          "axes",
        );
      const kept = before.find((b) => b.attributeId === attribute.attributeId);
      if (!kept && !attribute.active)
        return invalid(`Attribute ${attribute.code} is inactive and cannot be newly added`, "axes");
      const ids = raw.optionValueIds as string[];
      if (new Set(ids).size !== ids.length)
        return invalid(`Axis ${attribute.code} lists the same value twice`, "axes");
      for (const valueId of ids) {
        if (kept?.optionValueIds.includes(valueId)) continue;
        const problem = requireNewValue(attribute, valueId);
        if (problem) return problem;
      }
      const ordered = attribute.values
        .filter((v) => ids.includes(v.valueId))
        .sort(byDictionaryOrder);
      rows.push({
        attributeId: attribute.attributeId,
        sortOrder: typeof raw.sortOrder === "number" ? raw.sortOrder : index,
        optionValueIds: ordered.map((v) => v.valueId),
      });
    }
    const usedValues = new Set(
      (await mockVariantsOf(id)).flatMap((v) => v.options.map((o) => o.valueId)),
    );
    const sameAxes =
      before.length === rows.length &&
      before.every((b) => rows.some((r) => r.attributeId === b.attributeId));
    if (!sameAxes && product.status !== "Draft") {
      return fail(
        409,
        "PRODUCT_AXES_LOCKED",
        `Product ${id} is ${product.status}; its axes can no longer be added or removed`,
      );
    }
    const added = rows.some((r) => !before.some((b) => b.attributeId === r.attributeId));
    if (usedValues.size > 0 && added) {
      return fail(
        409,
        "PRODUCT_AXES_LOCKED",
        "Variants already use the current axes; an axis can no longer be added",
      );
    }
    for (const old of before) {
      const next = rows.find((r) => r.attributeId === old.attributeId);
      for (const valueId of old.optionValueIds) {
        if (!next?.optionValueIds.includes(valueId) && usedValues.has(valueId)) {
          return fail(
            409,
            "ATTRIBUTE_IN_USE",
            `A variant of this product uses value ${valueId}; it cannot be removed`,
          );
        }
      }
    }
    await setMockAxes(id, rows);
    const shape = (list: MockAxisRow[]) =>
      JSON.stringify(
        [...list]
          .sort((a, b) => a.attributeId.localeCompare(b.attributeId))
          .map((a) => [a.attributeId, a.sortOrder, [...a.optionValueIds].sort()]),
      );
    if (shape(before) !== shape(rows))
      recordMockHistory(id, "UPDATED", { changedFields: ["axes"] });
    return ok(await viewOf(id));
  });

  registerMockRoute("PUT", "/products/:id/descriptive-attributes", async (config) => {
    const id = pathParams(config).id ?? "";
    const product = await findMockProduct(id);
    if (!product) return productNotFound();
    const entries = bodyOf(config).attributes;
    if (!Array.isArray(entries)) return validationFailed("attributes", "attributes is required");
    if (!mockProductAcceptsChanges(product)) {
      return fail(
        409,
        "INVALID_PRODUCT_STATUS_TRANSITION",
        `Product ${id} is ${product.status} and accepts no change`,
      );
    }
    const dictionary = await mockDictionary();
    const before = await mockDescriptivesOf(id);
    const axes = await mockAxesOf(id);
    const rows: MockDescriptiveRow[] = [];
    const seen = new Set<string>();
    for (const [index, raw] of (entries as Record<string, unknown>[]).entries()) {
      const attribute = dictionary.find((a) => a.attributeId === raw.attributeId);
      if (!attribute)
        return fail(404, "ATTRIBUTE_NOT_FOUND", `Attribute ${String(raw.attributeId)} not found`);
      if (seen.has(attribute.attributeId))
        return invalid(
          `Attribute ${attribute.code} appears twice among the descriptive attributes`,
        );
      seen.add(attribute.attributeId);
      if (axes.some((a) => a.attributeId === attribute.attributeId))
        return invalid(
          `Attribute ${attribute.code} is a variant axis of this product; remove it from the axes first`,
        );
      const kept = before.find((b) => b.attributeId === attribute.attributeId);
      if (!kept && !attribute.active)
        return invalid(`Attribute ${attribute.code} is inactive and cannot be newly added`);
      const valueIds = Array.isArray(raw.valueIds) ? (raw.valueIds as string[]) : [];
      const hasText = typeof raw.text === "string";
      const hasNumber = typeof raw.number === "number";
      const hasBool = typeof raw.bool === "boolean";
      const row: MockDescriptiveRow = {
        attributeId: attribute.attributeId,
        sortOrder: typeof raw.sortOrder === "number" ? raw.sortOrder : index,
        valueIds: [],
        text: null,
        number: null,
        bool: null,
      };
      switch (attribute.dataType) {
        case "SELECT":
        case "COLOR":
        case "MULTISELECT": {
          if (hasText || hasNumber || hasBool)
            return invalid(`Attribute ${attribute.code} takes dictionary values only`);
          const single = attribute.dataType !== "MULTISELECT";
          if (valueIds.length === 0 || (single && valueIds.length !== 1))
            return invalid(
              single
                ? `Attribute ${attribute.code} takes exactly one value`
                : `Attribute ${attribute.code} takes at least one value`,
            );
          if (new Set(valueIds).size !== valueIds.length)
            return invalid(`Attribute ${attribute.code} lists the same value twice`);
          for (const valueId of valueIds) {
            if (kept?.valueIds.includes(valueId)) continue;
            const problem = requireNewValue(attribute, valueId);
            if (problem) return problem;
          }
          row.valueIds = valueIds;
          break;
        }
        case "TEXT":
          if (valueIds.length > 0 || hasNumber || hasBool)
            return invalid(`Attribute ${attribute.code} does not take that kind of value`);
          if (!hasText || !(raw.text as string).trim())
            return invalid(`Attribute ${attribute.code} needs a text`);
          row.text = (raw.text as string).trim();
          break;
        case "NUMBER":
          if (valueIds.length > 0 || hasText || hasBool)
            return invalid(`Attribute ${attribute.code} does not take that kind of value`);
          if (!hasNumber) return invalid(`Attribute ${attribute.code} needs a number`);
          row.number = raw.number as number;
          break;
        case "BOOLEAN":
          if (valueIds.length > 0 || hasText || hasNumber)
            return invalid(`Attribute ${attribute.code} does not take that kind of value`);
          if (!hasBool) return invalid(`Attribute ${attribute.code} needs true or false`);
          row.bool = raw.bool as boolean;
          break;
      }
      rows.push(row);
    }
    await setMockDescriptives(id, rows);
    const shape = (list: MockDescriptiveRow[]) =>
      JSON.stringify(
        [...list]
          .sort((a, b) => a.attributeId.localeCompare(b.attributeId))
          .map((d) => [
            d.attributeId,
            d.sortOrder,
            [...d.valueIds].sort(),
            d.text,
            d.number,
            d.bool,
          ]),
      );
    if (shape(before) !== shape(rows)) {
      recordMockHistory(id, "UPDATED", { changedFields: ["descriptiveAttributes"] });
    }
    return ok(await viewOf(id));
  });
}
