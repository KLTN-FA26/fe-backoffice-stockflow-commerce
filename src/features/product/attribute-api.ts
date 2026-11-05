/**
 * API từ điển thuộc tính (BE PR #113): `GET/POST/PUT/DELETE /attributes[/{id}]`, giá trị
 * `POST/PUT/DELETE /attributes/{id}/values[/{valueId}]`, bộ thuộc tính danh mục
 * `GET/PUT /categories/{id}/attributes`. Parse zod tại biên; mock adapter trả đúng hình response BE.
 */
import { api } from "@/lib/api/client";

import {
  beAttributePageSchema,
  beAttributeSchema,
  beCategoryAttributeSchema,
  replaceCategoryAttributesSchema,
} from "./attribute-schemas";

import type { z } from "zod";
import type {
  Attribute,
  AttributeDataType,
  AttributeFormValues,
  AttributeValueFormValues,
  CategoryAttribute,
  CategoryAttributeEntry,
} from "./attribute-schemas";

const attributePath = (id: string) => `/attributes/${encodeURIComponent(id)}`;
const valuePath = (id: string, valueId: string) =>
  `${attributePath(id)}/values/${encodeURIComponent(valueId)}`;
const categoryAttributesPath = (categoryId: string) =>
  `/categories/${encodeURIComponent(categoryId)}/attributes`;

/** Một trang tối đa của BE (`Pages.MAX_PAGE_SIZE`): từ điển nhỏ, màn danh sách lọc / chia trang phía FE. */
export const ATTRIBUTE_LIST_SIZE = 200;

export interface ListAttributesParams {
  q?: string;
  dataType?: AttributeDataType;
  active?: boolean;
}

export type AttributePage = z.infer<typeof beAttributePageSchema>;

export async function listAttributes(
  params: ListAttributesParams = {},
  signal?: AbortSignal,
): Promise<AttributePage> {
  const query = new URLSearchParams({ page: "0", size: String(ATTRIBUTE_LIST_SIZE) });
  if (params.q?.trim()) query.set("q", params.q.trim());
  if (params.dataType) query.set("dataType", params.dataType);
  if (params.active !== undefined) query.set("active", String(params.active));
  const { data } = await api.get<unknown>("/attributes", { params: query, signal });
  return beAttributePageSchema.parse(data);
}

export async function getAttribute(id: string, signal?: AbortSignal): Promise<Attribute> {
  const { data } = await api.get<unknown>(attributePath(id), { signal });
  return beAttributeSchema.parse(data);
}

const optionalInt = (raw: string) => (raw.trim() === "" ? undefined : Number(raw));
const optionalNumber = (raw: string) => (raw.trim() === "" ? null : Number(raw));

/** Form → `CreateAttributeRequest` (mã và loại cố định sau khi tạo). */
export function createAttributeBody(values: AttributeFormValues) {
  return {
    code: values.code.trim(),
    dataType: values.dataType,
    name: values.name.trim(),
    unit: values.unit.trim() || undefined,
    filterable: values.filterable,
    searchable: values.searchable,
    sortOrder: optionalInt(values.sortOrder),
  };
}

/** Form → `UpdateAttributeRequest`: `version` của lần đọc trước, `active` bắt buộc. */
export function updateAttributeBody(values: AttributeFormValues, version: number) {
  return {
    version,
    name: values.name.trim(),
    unit: values.unit.trim() || undefined,
    filterable: values.filterable,
    searchable: values.searchable,
    sortOrder: optionalInt(values.sortOrder),
    active: values.active,
  };
}

export async function createAttribute(values: AttributeFormValues): Promise<Attribute> {
  const { data } = await api.post<unknown>("/attributes", createAttributeBody(values));
  return beAttributeSchema.parse(data);
}

export async function updateAttribute(input: {
  attributeId: string;
  version: number;
  values: AttributeFormValues;
}): Promise<Attribute> {
  const { data } = await api.put<unknown>(
    attributePath(input.attributeId),
    updateAttributeBody(input.values, input.version),
  );
  return beAttributeSchema.parse(data);
}

/** BE: `?version=` bắt buộc; thuộc tính còn được sản phẩm / danh mục dùng → 409 ATTRIBUTE_IN_USE. */
export async function deleteAttribute(input: {
  attributeId: string;
  version: number;
}): Promise<void> {
  await api.delete(attributePath(input.attributeId), { params: { version: input.version } });
}

/** Form → `CreateAttributeValueRequest` / `UpdateAttributeValueRequest` (màu viết hoa như BE). */
function valueBody(values: AttributeValueFormValues) {
  return {
    label: values.label.trim(),
    valueNumber: optionalNumber(values.valueNumber),
    hexColor: values.hexColor.trim().toUpperCase() || undefined,
    sortOrder: optionalInt(values.sortOrder),
  };
}

/** Các thao tác trên giá trị trả về cả thuộc tính đã cập nhật. */
export async function addAttributeValue(input: {
  attributeId: string;
  values: AttributeValueFormValues;
}): Promise<Attribute> {
  const { data } = await api.post<unknown>(`${attributePath(input.attributeId)}/values`, {
    code: input.values.code.trim(),
    ...valueBody(input.values),
  });
  return beAttributeSchema.parse(data);
}

export async function updateAttributeValue(input: {
  attributeId: string;
  valueId: string;
  version: number;
  values: AttributeValueFormValues;
}): Promise<Attribute> {
  const { data } = await api.put<unknown>(valuePath(input.attributeId, input.valueId), {
    version: input.version,
    ...valueBody(input.values),
    active: input.values.active,
  });
  return beAttributeSchema.parse(data);
}

/** BE: `?version=` của giá trị bắt buộc; giá trị còn được dùng → 409 ATTRIBUTE_IN_USE. */
export async function deleteAttributeValue(input: {
  attributeId: string;
  valueId: string;
  version: number;
}): Promise<Attribute> {
  const { data } = await api.delete<unknown>(valuePath(input.attributeId, input.valueId), {
    params: { version: input.version },
  });
  return beAttributeSchema.parse(data);
}

export async function listCategoryAttributes(
  categoryId: string,
  signal?: AbortSignal,
): Promise<CategoryAttribute[]> {
  const { data } = await api.get<unknown>(categoryAttributesPath(categoryId), { signal });
  if (!Array.isArray(data)) throw new Error("Category attribute response is malformed");
  return data.map((row) => beCategoryAttributeSchema.parse(row));
}

export async function replaceCategoryAttributes(input: {
  categoryId: string;
  attributes: CategoryAttributeEntry[];
}): Promise<CategoryAttribute[]> {
  const body = replaceCategoryAttributesSchema.parse({ attributes: input.attributes });
  const { data } = await api.put<unknown>(categoryAttributesPath(input.categoryId), body);
  if (!Array.isArray(data)) throw new Error("Category attribute response is malformed");
  return data.map((row) => beCategoryAttributeSchema.parse(row));
}
