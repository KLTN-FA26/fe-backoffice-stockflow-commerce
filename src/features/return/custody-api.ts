/**
 * Hàng giữ hộ khách sau một yêu cầu không hoàn tiền (WF-05 Q-4 / TH-6, audit r2 returns H1) — BE `StockPackageController`:
 * danh sách thùng giữ hộ (`inventory-stock-packages:READ`, theo kho của người xem) và Quản lý kho ghi đã thực hiện lựa chọn
 * của khách (`inventory-stock-packages:UPDATE`). Không có bút toán kho: thùng đã ngoài sổ từ lúc yêu cầu kết thúc.
 */

import { CUSTOMER_CUSTODY_API, RETURN_CUSTODY_NOTE_API } from "@/constants/returns";
import { api } from "@/lib/api/client";

import {
  custodyNotePageDtoSchema,
  custodyOutcomeDtoSchema,
  customerCustodyDtoSchema,
  customerCustodyPageDtoSchema,
  returnRequestDtoSchema,
} from "./schemas";

import type { ReturnCustodyNoteChoice } from "@/constants/returns";
import type { PaginatedResponse } from "@/lib/api/query-factory";
import type { CustodyNote, CustodyOutcome, CustomerCustodyCarton, ReturnRequest } from "./types";

export interface CustomerCustodyParams {
  /** Chỉ thùng của một yêu cầu trả hàng. */
  returnRequestId?: string;
  /** true = các thùng đã gửi trả / đã huỷ hộ; mặc định = đang giữ. */
  ended?: boolean;
  page?: number;
  size?: number;
}

export async function listCustomerCustody(
  params: CustomerCustodyParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<CustomerCustodyCarton>> {
  const query = new URLSearchParams({
    page: String(Math.max(0, params.page ?? 0)),
    size: String(params.size ?? 50),
    ended: String(params.ended ?? false),
  });
  if (params.returnRequestId) query.set("returnRequestId", params.returnRequestId);
  const { data } = await api.get<unknown>(CUSTOMER_CUSTODY_API.list, { params: query, signal });
  return customerCustodyPageDtoSchema.parse(data);
}

/**
 * Quản lý kho ghi đã giao trả / đã huỷ hộ đúng lựa chọn khách (ghi chú = số biên bản, bắt buộc ≤ 500). 404
 * STOCK_PACKAGE_NOT_FOUND (cả thùng không giữ hộ), 409 STOCK_PACKAGE_DECISION_PENDING (chưa có lựa chọn),
 * INVALID_STOCK_PACKAGE_TRANSITION (đã thực hiện).
 */
export async function endCustomerCustody(input: {
  lpn: string;
  note: string;
}): Promise<CustomerCustodyCarton> {
  const { data } = await api.post<unknown>(CUSTOMER_CUSTODY_API.end(input.lpn), {
    note: input.note.trim(),
  });
  return customerCustodyDtoSchema.parse(data);
}

/* ── Hàng giữ hộ trên biên nhận (audit r3 RAD-3; Q-11 hỏi thêm, TH-6) ──────────────────────────── */

export interface CustodyNoteParams {
  /** Chỉ biên nhận của một yêu cầu trả hàng. */
  returnRequestId?: string;
  /** true = hàng đã rời kho (mới nhất trước); mặc định = đang giữ (cũ nhất trước). */
  ended?: boolean;
  page?: number;
  size?: number;
}

/** `GET /returns/custody-notes` (`sales-rma-custody:READ`, theo kho của người xem). */
export async function listCustodyNotes(
  params: CustodyNoteParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<CustodyNote>> {
  const query = new URLSearchParams({
    page: String(Math.max(0, params.page ?? 0)),
    size: String(params.size ?? 50),
    ended: String(params.ended ?? false),
  });
  if (params.returnRequestId) query.set("returnRequestId", params.returnRequestId);
  const { data } = await api.get<unknown>(RETURN_CUSTODY_NOTE_API.list, { params: query, signal });
  return custodyNotePageDtoSchema.parse(data);
}

/**
 * Sale ghi lựa chọn của khách cho hàng trên biên nhận `evidenceId` (`sales-rmas:UPDATE`, chỉ back office): huỷ hộ phải có
 * biên bản (`note`), nhận trên yêu cầu bổ sung phải nêu `takenByReturnId`. Ghi lại thay lựa chọn cũ khi hàng còn giữ. Trả
 * về yêu cầu. 409 RETURN_INVALID_TRANSITION (hàng đã rời kho, yêu cầu bổ sung không nhận hàng), 400 VALIDATION_FAILED.
 */
export async function chooseForCustodyNote(input: {
  returnId: string;
  evidenceId: string;
  choice: ReturnCustodyNoteChoice;
  note?: string;
  takenByReturnId?: string;
}): Promise<ReturnRequest> {
  const note = input.note?.trim();
  const { data } = await api.post<unknown>(
    RETURN_CUSTODY_NOTE_API.choice(input.returnId, input.evidenceId),
    {
      choice: input.choice,
      ...(note ? { note } : {}),
      ...(input.choice === "TAKEN_BY_RETURN" && input.takenByReturnId
        ? { takenByReturnId: input.takenByReturnId }
        : {}),
    },
  );
  return returnRequestDtoSchema.parse(data);
}

/**
 * Quản lý kho ghi hàng trên biên nhận đã rời kho đúng lựa chọn (`sales-rma-custody:UPDATE`): `note` = biên bản (bắt buộc,
 * ≤ 500). Ghi một lần. 409 RETURN_CUSTODY_CHOICE_REQUIRED (Sale chưa ghi lựa chọn), RETURN_INVALID_TRANSITION (đã ghi, hoặc
 * yêu cầu bổ sung đã bị từ chối / rút / hết hạn — Sale chọn lại).
 */
export async function endCustodyNote(input: {
  returnId: string;
  evidenceId: string;
  note: string;
}): Promise<CustodyOutcome> {
  const { data } = await api.post<unknown>(
    RETURN_CUSTODY_NOTE_API.end(input.returnId, input.evidenceId),
    { note: input.note.trim() },
  );
  return custodyOutcomeDtoSchema.parse(data);
}
