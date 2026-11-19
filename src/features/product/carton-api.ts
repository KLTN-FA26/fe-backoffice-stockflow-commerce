/**
 * API đơn vị tính / quy cách thùng của SKU — BE `UomConversionController`. Parse zod tại biên; mock
 * adapter (`mock-routes-uom-conversions.ts`) trả đúng hình response BE. Xem `carton-schemas.ts`.
 */
import { api } from "@/lib/api/client";

import { beUomConversionSchema, cartonSpecFormSchema, cartonUnitBody } from "./carton-schemas";

import type { CartonSpecFormValues, UomConversion } from "./carton-schemas";

const unitsPath = (productId: string, variantId: string) =>
  `/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}/uom-conversions`;

/** BE giới hạn trang 200 (`Pages.MAX_PAGE_SIZE`); một SKU chỉ có vài đơn vị. */
const UNIT_PAGE_SIZE = 200;

/** Đơn vị cơ sở trước, rồi các đơn vị đóng gói theo mã (thứ tự BE). */
export async function listSkuUnits(
  productId: string,
  variantId: string,
  signal?: AbortSignal,
): Promise<UomConversion[]> {
  const { data } = await api.get<unknown>(unitsPath(productId, variantId), {
    params: { page: 0, size: UNIT_PAGE_SIZE },
    signal,
  });
  const items = (data as { items?: unknown }).items;
  if (!Array.isArray(items)) throw new Error("UoM conversion page response is malformed");
  return items.map((row) => beUomConversionSchema.parse(row));
}

export interface SaveCartonSpecInput {
  productId: string;
  variantId: string;
  /** Thùng đang sửa (giữ `version`, `defaultPurchase`); null = khai báo thùng mới. */
  carton: UomConversion | null;
  values: CartonSpecFormValues;
}

/**
 * Khai báo (`POST`) hoặc thay (`PUT`, kèm `version`) đơn vị thùng. PUT là thay toàn bộ: giữ nguyên
 * `defaultPurchase` đang có và `active=true` (thùng là đơn vị còn dùng). Giá trị sai bị zod chặn trước
 * khi rời trình duyệt.
 */
export async function saveCartonSpec(input: SaveCartonSpecInput): Promise<UomConversion> {
  const body = cartonUnitBody(cartonSpecFormSchema.parse(input.values));
  const path = unitsPath(input.productId, input.variantId);
  if (input.carton === null) {
    const { data } = await api.post<unknown>(path, { ...body, defaultPurchase: false });
    return beUomConversionSchema.parse(data);
  }
  const { data } = await api.put<unknown>(`${path}/${encodeURIComponent(input.carton.id)}`, {
    ...body,
    version: input.carton.version,
    defaultPurchase: input.carton.defaultPurchase,
    active: true,
  });
  return beUomConversionSchema.parse(data);
}

export interface SkuUnitInput {
  productId: string;
  variantId: string;
  unit: UomConversion;
}

/**
 * Ngưng dùng một đơn vị đóng gói (docs 01 BR-10): PUT giữ nguyên mã / hệ số / số đo, `active=false`; đơn vị ngưng
 * không làm đơn vị mua / giao mặc định được (BE `UomConversionRules`) nên gửi cả hai `false`.
 */
export async function retireSkuUnit(input: SkuUnitInput): Promise<UomConversion> {
  const { unit } = input;
  const { data } = await api.put<unknown>(
    `${unitsPath(input.productId, input.variantId)}/${encodeURIComponent(unit.id)}`,
    {
      version: unit.version,
      unitOfMeasure: unit.unitOfMeasure,
      factor: unit.factor,
      weightKg: unit.weightKg ?? null,
      lengthCm: unit.lengthCm ?? null,
      widthCm: unit.widthCm ?? null,
      heightCm: unit.heightCm ?? null,
      defaultPurchase: false,
      active: false,
      defaultShipping: false,
    },
  );
  return beUomConversionSchema.parse(data);
}

/** Xoá một đơn vị đóng gói chưa từng dùng — `DELETE …/{id}?version=`; đơn vị đang bán / đã dùng → 409 IN_USE. */
export async function deleteSkuUnit(input: SkuUnitInput): Promise<void> {
  await api.delete(
    `${unitsPath(input.productId, input.variantId)}/${encodeURIComponent(input.unit.id)}`,
    { params: { version: input.unit.version } },
  );
}
