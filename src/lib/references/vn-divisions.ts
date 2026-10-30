/**
 * Tỉnh / thành phố và phường / xã Việt Nam (2 cấp, sau sắp xếp 07/2025) cho ô chọn địa chỉ — API công
 * khai provinces.open-api.vn v2. Gọi bằng `fetch` thường, KHÔNG qua axios `api` của app: client đó gắn
 * JWT, không được gửi sang bên thứ ba. Parse tại biên bằng zod; đặt ở `lib/` để module khác dùng chung.
 */

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { VN_DIVISIONS_API, VN_DIVISIONS_STALE_MS } from "@/constants";

const divisionDto = z.object({
  code: z.number().int(),
  name: z.string(),
  /** Tên không dấu nối `_` (vd `phuong_thu_dau_mot`) — để gõ không dấu vẫn tìm được. */
  codename: z.string(),
});

const provinceWithWardsDto = divisionDto.extend({ wards: z.array(divisionDto) });

export type VnDivision = z.infer<typeof divisionDto>;

async function getJson(path: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(`${VN_DIVISIONS_API.base}${path}`, { signal });
  if (!response.ok) throw new Error(`VN divisions API ${response.status}`);
  return response.json();
}

export async function fetchVnProvinces(signal?: AbortSignal): Promise<VnDivision[]> {
  return z.array(divisionDto).parse(await getJson(VN_DIVISIONS_API.provinces, signal));
}

export async function fetchVnWards(
  provinceCode: number,
  signal?: AbortSignal,
): Promise<VnDivision[]> {
  return provinceWithWardsDto.parse(await getJson(VN_DIVISIONS_API.province(provinceCode), signal))
    .wards;
}

export const vnDivisionKeys = {
  all: ["vn-divisions"] as const,
  provinces: () => [...vnDivisionKeys.all, "provinces"] as const,
  wards: (provinceCode: number) => [...vnDivisionKeys.all, "wards", provinceCode] as const,
};

const CACHE = { staleTime: VN_DIVISIONS_STALE_MS, gcTime: VN_DIVISIONS_STALE_MS, retry: 1 };

export function useVnProvinces(enabled = true) {
  return useQuery({
    queryKey: vnDivisionKeys.provinces(),
    queryFn: ({ signal }) => fetchVnProvinces(signal),
    enabled,
    ...CACHE,
  });
}

export function useVnWards(provinceCode: number | null) {
  return useQuery({
    queryKey: vnDivisionKeys.wards(provinceCode ?? 0),
    queryFn: ({ signal }) => fetchVnWards(provinceCode ?? 0, signal),
    enabled: provinceCode !== null,
    ...CACHE,
  });
}

/** Ghép địa chỉ một dòng như BE lưu: "số nhà đường, phường / xã, tỉnh / thành" (bỏ phần trống). */
export const joinVnAddress = (street: string, ward: string, province: string): string =>
  [street, ward, province]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
