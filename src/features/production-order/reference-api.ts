/** Đọc kèm LSX cho màn quét xuất phôi / QC — BE PR #109 (xem `reference-schemas.ts`). */

import { api } from "@/lib/api/client";

import { byId } from "./http";
import {
  approvedSampleDtoSchema,
  packingLocationsDtoSchema,
  pendingIssueDtoSchema,
} from "./reference-schemas";

/** `production-material-issues:READ`. Holds chỉ có khi LSX đang READY và làm tại xưởng. */
export async function getPendingIssue(id: string, signal?: AbortSignal) {
  const { data } = await api.get<unknown>(`${byId(id)}/material-issues/pending`, { signal });
  return pendingIssueDtoSchema.parse(data);
}

/**
 * `production-orders:READ`. 404 = LSX mẫu / thiết kế in lại không có lần mẫu duyệt; 409 = lần mẫu không còn là
 * lần đã duyệt của LSX (dữ liệu đổi bên dưới). BE trả `Cache-Control: no-store` vì body chứa link ký.
 */
export async function getApprovedSample(id: string, signal?: AbortSignal) {
  const { data } = await api.get<unknown>(`${byId(id)}/approved-sample`, { signal });
  return approvedSampleDtoSchema.parse(data);
}

/** `production-qc-results:READ`. Khu PACKING dùng được của kho LSX, đã sắp xếp; một khu = mặc định. */
export async function getPackingLocations(id: string, signal?: AbortSignal) {
  const { data } = await api.get<unknown>(`${byId(id)}/packing-locations`, { signal });
  return packingLocationsDtoSchema.parse(data);
}
