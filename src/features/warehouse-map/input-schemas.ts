/**
 * Form khai báo kho và zone — phản chiếu `RegisterWarehouseRequest`, `CreateZoneRequest` của BE
 * (docs 06 §3, §6). Ô nhập là chuỗi; schema kiểm rồi đổi sang số. FE kiểm trước để báo lỗi tại ô —
 * Backend phải re-check. Kệ / khu vực / tường-cửa vẽ trên bản nháp bản đồ: `draft-rules.ts`.
 */

import { z } from "zod";

import { MAP_UNITS, UI_LABELS, WAREHOUSE_MAP_LIMITS as LIMITS } from "@/constants";

import { joinVnAddress } from "@/lib/references/vn-divisions";

import { hasAtMostDecimals } from "./selectors";

const V = UI_LABELS.warehouseMap.validation;

/** BR-10: mỗi thành phần mã vị trí chỉ gồm A–Z, 0–9, không có "-" (chữ thường tự viết hoa). */
export const LOCATION_PART_PATTERN = /^[A-Za-z0-9]+$/;

/** Người dùng Việt gõ dấu phẩy thập phân; BE nhận dấu chấm. */
const normalise = (raw: string) => raw.trim().replace(",", ".");
const isNumeric = (raw: string) => /^-?\d+(\.\d+)?$/.test(normalise(raw));

/**
 * Số đo mét (`@Digits(integer = 7, fraction = 3)`): `positive` = phải > 0 (rộng / dài),
 * ngược lại ≥ 0 (toạ độ). Quá 3 số lẻ bị từ chối, không làm tròn (docs 06 §3).
 */
export function measure({ positive }: { positive: boolean }) {
  return z
    .string()
    .trim()
    .min(1, V.required)
    .refine(isNumeric, V.required)
    .transform((raw) => Number(normalise(raw)))
    .refine((value) => (positive ? value > 0 : value >= 0), positive ? V.positive : V.nonNegative)
    .refine((value) => value <= LIMITS.measureMax, V.positive)
    .refine((value) => hasAtMostDecimals(value, LIMITS.measureFractionDigits), V.fraction);
}

/** Mã kệ / bin / khu vực — BR-10: ≤ 20 ký tự A–Z0–9; gửi chữ hoa như BE sẽ lưu. */
export const locationPart = (max: number, message: string) =>
  z
    .string()
    .trim()
    .min(1, V.required)
    .max(max, message)
    .regex(LOCATION_PART_PATTERN, message)
    .transform((value) => value.toUpperCase());

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, V.tooLong(max))
    .transform((value) => (value === "" ? null : value));

/* ── Khai báo kho (docs 06 §4.1 bước 1) ───────────────────────────────── */

export const warehouseCreateSchema = z
  .object({
    // BR-10 / BR-13: prefix 1–10 ký tự A–Z0–9, duy nhất toàn hệ thống, không đổi sau khi tạo
    prefix: locationPart(LIMITS.prefixMax, V.prefixFormat),
    name: z.string().trim().min(1, V.required).max(LIMITS.nameMax, V.tooLong(LIMITS.nameMax)),
    // Địa chỉ chọn theo đơn vị hành chính 2 cấp rồi ghép thành một dòng `address` như BE lưu
    street: z.string().trim().min(1, V.required),
    /** Mã tỉnh để tải phường / xã — chỉ dùng trong form, không gửi BE. */
    provinceCode: z.string(),
    provinceName: z.string().trim().min(1, V.provinceRequired),
    wardName: z.string().trim().min(1, V.wardRequired),
    returnAddress: optionalText(LIMITS.addressMax),
    // BR-13: đơn vị bản đồ chỉ mét và không đổi
    mapUnit: z.enum(MAP_UNITS),
    mapWidth: measure({ positive: true }),
    mapHeight: measure({ positive: true }),
  })
  .superRefine((value, ctx) => {
    // RegisterWarehouseRequest.address @Size(max = 500) — tính trên chuỗi đã ghép
    if (joinVnAddress(value.street, value.wardName, value.provinceName).length > LIMITS.addressMax)
      ctx.addIssue({ code: "custom", message: V.tooLong(LIMITS.addressMax), path: ["street"] });
  })
  .transform(({ street, provinceCode: _code, provinceName, wardName, ...rest }) => ({
    ...rest,
    address: joinVnAddress(street, wardName, provinceName),
  }));

export type WarehouseCreateInput = z.input<typeof warehouseCreateSchema>;
export type WarehouseCreateBody = z.output<typeof warehouseCreateSchema>;

export const EMPTY_WAREHOUSE_FORM: WarehouseCreateInput = {
  prefix: "",
  name: "",
  street: "",
  provinceCode: "",
  provinceName: "",
  wardName: "",
  returnAddress: "",
  mapUnit: "M",
  mapWidth: "",
  mapHeight: "",
};

/* ── Zone (docs 06 §4.1 bước 2) ───────────────────────────────────────── */

/** Tên zone duy nhất trong kho (409 ZONE_NAME_ALREADY_EXISTS) — kiểm trước với danh sách đang có. */
export function zoneCreateSchema(existingNames: readonly string[]) {
  const taken = new Set(existingNames.map((name) => name.trim().toLowerCase()));
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, V.required)
      .max(LIMITS.zoneNameMax, V.tooLong(LIMITS.zoneNameMax))
      .refine((name) => !taken.has(name.toLowerCase()), V.zoneNameTaken),
    color: z
      .string()
      .trim()
      .refine((value) => value === "" || /^#[0-9A-Fa-f]{6}$/.test(value), V.colorFormat)
      .transform((value) => (value === "" ? null : value)),
  });
}

export type ZoneCreateInput = z.input<ReturnType<typeof zoneCreateSchema>>;
export type ZoneCreateBody = z.output<ReturnType<typeof zoneCreateSchema>>;
