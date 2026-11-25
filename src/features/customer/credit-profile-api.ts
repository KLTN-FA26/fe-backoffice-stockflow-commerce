/** `PUT /customers/{id}/credit-profile` — cấp / sửa hạn mức công nợ (`customer-credit-profiles:APPROVE`, AUTH-6). */

import { api } from "@/lib/api/client";

import { creditProfileDtoSchema } from "./schemas";

import type { CreditProfile, CreditProfileValues } from "./types";

export interface SaveCreditProfileInput {
  id: string;
  /** Version của bản đã mở (GET trả -1 khi chưa cấu hình): BE so với bản hiện tại, lệch → 409 `OPTIMISTIC_LOCK`. */
  expectedVersion: number;
  values: CreditProfileValues;
}

/** Hai ô trống = không cho công nợ (BE nhận cả hai `null`). Ghi chú trống = bỏ ghi chú. */
export async function saveCreditProfile({
  id,
  expectedVersion,
  values,
}: SaveCreditProfileInput): Promise<CreditProfile> {
  const note = values.note.trim();
  const body = {
    creditLimit: values.creditLimit === "" ? null : Number(values.creditLimit),
    creditTermDays: values.creditTermDays === "" ? null : Number(values.creditTermDays),
    ...(note ? { note } : {}),
    expectedVersion,
  };
  const { data } = await api.put<unknown>(
    `/customers/${encodeURIComponent(id)}/credit-profile`,
    body,
  );
  return creditProfileDtoSchema.parse(data);
}
