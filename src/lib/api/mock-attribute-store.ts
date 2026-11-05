/**
 * Kho từ điển thuộc tính, bộ thuộc tính danh mục, trục và thuộc tính mô tả của sản phẩm cho mock
 * (BE PR #113, #114). Seed suy ra từ mock-data: thuộc tính khai trong `products[].attributes`
 * (màu có `swatch` → loại COLOR, còn lại SELECT) cùng giá trị các SKU đang dùng; một sản phẩm có
 * trục khi mọi SKU của nó mang cùng bộ thuộc tính. Không bịa bản ghi mới.
 *
 * Chỉ dữ liệu + hàm thuần; route ở `mock-routes-attributes.ts` và `mock-routes-product-attributes.ts`.
 */

import { slugCode } from "./mock-route-utils";

export type MockAttrType = "TEXT" | "NUMBER" | "BOOLEAN" | "SELECT" | "MULTISELECT" | "COLOR";

export interface MockAttrValue {
  valueId: string;
  code: string;
  label: string;
  valueNumber: number | null;
  hexColor: string | null;
  sortOrder: number;
  active: boolean;
  version: number;
}

export interface MockAttribute {
  attributeId: string;
  code: string;
  name: string;
  dataType: MockAttrType;
  unit: string | null;
  filterable: boolean;
  searchable: boolean;
  sortOrder: number;
  active: boolean;
  version: number;
  values: MockAttrValue[];
}

export interface MockCategoryAttribute {
  attributeId: string;
  defaultRole: "VARIANT_AXIS" | "DESCRIPTIVE";
  required: boolean;
  sortOrder: number;
}

/** Một trục của sản phẩm: thuộc tính + các giá trị được chọn (thứ tự hiển thị theo từ điển). */
export interface MockAxisRow {
  attributeId: string;
  sortOrder: number;
  optionValueIds: string[];
}

export interface MockDescriptiveRow {
  attributeId: string;
  sortOrder: number;
  valueIds: string[];
  text: string | null;
  number: number | null;
  bool: boolean | null;
}

let dictionary: MockAttribute[] | null = null;
const categoryAttributes = new Map<string, MockCategoryAttribute[]>();
const axesByProduct = new Map<string, MockAxisRow[]>();
const descriptivesByProduct = new Map<string, MockDescriptiveRow[]>();
let seeded: Promise<void> | null = null;

export function resetAttributeMockStore(): void {
  dictionary = null;
  seeded = null;
  categoryAttributes.clear();
  axesByProduct.clear();
  descriptivesByProduct.clear();
}

/** BE `AttributeValue.DICTIONARY_ORDER`: thứ tự sắp xếp của giá trị, rồi mã. */
export const byDictionaryOrder = (a: MockAttrValue, b: MockAttrValue): number =>
  a.sortOrder - b.sortOrder || a.code.localeCompare(b.code);

const attributeIdOfKey = (key: string) => `ATTR-${slugCode(key)}`;

async function seed(): Promise<void> {
  const { products, skus } = await import("@/lib/mock-data");
  const attributes = new Map<string, MockAttribute>();
  const ensure = (attributeId: string, name: string, code: string, color: boolean) => {
    let attribute = attributes.get(attributeId);
    if (!attribute) {
      attribute = {
        attributeId,
        code,
        name,
        dataType: color ? "COLOR" : "SELECT",
        unit: null,
        filterable: true,
        searchable: false,
        sortOrder: attributes.size,
        active: true,
        version: 0,
        values: [],
      };
      attributes.set(attributeId, attribute);
    }
    return attribute;
  };
  const addValue = (attribute: MockAttribute, label: string, hex: string | undefined) => {
    const code = slugCode(label);
    if (attribute.values.some((v) => v.code === code)) return;
    // BE: giá trị COLOR bắt buộc có màu; không có `swatch` thì không đưa vào từ điển.
    if (attribute.dataType === "COLOR" && !hex) return;
    attribute.values.push({
      valueId: `${attribute.attributeId}:${code}`,
      code,
      label,
      valueNumber: null,
      hexColor: attribute.dataType === "COLOR" ? (hex?.toUpperCase() ?? null) : null,
      sortOrder: attribute.values.length,
      active: true,
      version: 0,
    });
  };
  for (const product of products) {
    for (const attr of product.attributes) {
      const attribute = ensure(
        attr.attributeId,
        attr.name.vi,
        slugCode(attr.name.en),
        Boolean(attr.swatch),
      );
      for (const value of attr.values) addValue(attribute, value, attr.swatch?.[value]);
    }
  }
  for (const sku of skus) {
    for (const [key, value] of Object.entries(sku.attributes)) {
      const attribute = attributes.get(attributeIdOfKey(key));
      if (attribute) addValue(attribute, value, undefined);
    }
  }
  dictionary = [...attributes.values()];

  // Trục theo sản phẩm: mọi SKU cùng một bộ khoá thuộc tính không rỗng.
  const byProduct = new Map<string, typeof skus>();
  for (const sku of skus)
    byProduct.set(sku.productId, [...(byProduct.get(sku.productId) ?? []), sku]);
  for (const [productId, rows] of byProduct) {
    const keys = Object.keys(rows[0]?.attributes ?? {}).sort();
    const uniform =
      keys.length > 0 &&
      rows.every((r) => Object.keys(r.attributes).sort().join("|") === keys.join("|"));
    if (!uniform) continue;
    const axes: MockAxisRow[] = [];
    for (const key of keys) {
      const attribute = attributes.get(attributeIdOfKey(key));
      if (!attribute) break;
      const wanted = new Set(rows.map((r) => slugCode(r.attributes[key] ?? "")));
      const options = attribute.values.filter((v) => wanted.has(v.code)).sort(byDictionaryOrder);
      if (options.length === 0) break;
      axes.push({
        attributeId: attribute.attributeId,
        sortOrder: axes.length,
        optionValueIds: options.map((v) => v.valueId),
      });
    }
    if (axes.length === keys.length) axesByProduct.set(productId, axes);
  }
}

/** Nạp seed một lần (idempotent). Mọi hàm truy cập kho phải `await` trước. */
export function ensureAttributeStore(): Promise<void> {
  seeded ??= seed();
  return seeded;
}

export async function mockDictionary(): Promise<MockAttribute[]> {
  await ensureAttributeStore();
  return dictionary ?? [];
}

export async function findMockAttribute(attributeId: string): Promise<MockAttribute | undefined> {
  return (await mockDictionary()).find((a) => a.attributeId === attributeId);
}

export async function mockCategoryAttributes(categoryId: string): Promise<MockCategoryAttribute[]> {
  await ensureAttributeStore();
  return categoryAttributes.get(categoryId) ?? [];
}

export async function setMockCategoryAttributes(
  categoryId: string,
  rows: MockCategoryAttribute[],
): Promise<void> {
  await ensureAttributeStore();
  categoryAttributes.set(categoryId, rows);
}

export async function mockAxesOf(productId: string): Promise<MockAxisRow[]> {
  await ensureAttributeStore();
  return [...(axesByProduct.get(productId) ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function setMockAxes(productId: string, axes: MockAxisRow[]): Promise<void> {
  await ensureAttributeStore();
  axesByProduct.set(productId, axes);
}

export async function mockDescriptivesOf(productId: string): Promise<MockDescriptiveRow[]> {
  await ensureAttributeStore();
  return [...(descriptivesByProduct.get(productId) ?? [])].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
}

export async function setMockDescriptives(
  productId: string,
  rows: MockDescriptiveRow[],
): Promise<void> {
  await ensureAttributeStore();
  descriptivesByProduct.set(productId, rows);
}

export function dropMockProductAttributes(productId: string): void {
  axesByProduct.delete(productId);
  descriptivesByProduct.delete(productId);
}

/**
 * BE `AttributeRepository#isInUse`: thuộc tính còn là trục / thuộc tính mô tả của một sản phẩm hoặc
 * thuộc bộ thuộc tính của một danh mục.
 */
export async function isMockAttributeInUse(attributeId: string): Promise<boolean> {
  await ensureAttributeStore();
  return (
    [...axesByProduct.values()].some((rows) => rows.some((r) => r.attributeId === attributeId)) ||
    [...descriptivesByProduct.values()].some((rows) =>
      rows.some((r) => r.attributeId === attributeId),
    ) ||
    [...categoryAttributes.values()].some((rows) => rows.some((r) => r.attributeId === attributeId))
  );
}

/** BE `AttributeRepository#isValueInUse`: giá trị còn là tuỳ chọn của trục hoặc giá trị mô tả của sản phẩm. */
export async function isMockValueInUse(valueId: string): Promise<boolean> {
  await ensureAttributeStore();
  return (
    [...axesByProduct.values()].some((rows) =>
      rows.some((r) => r.optionValueIds.includes(valueId)),
    ) ||
    [...descriptivesByProduct.values()].some((rows) =>
      rows.some((r) => r.valueIds.includes(valueId)),
    )
  );
}
