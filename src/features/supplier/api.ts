/**
 * Supplier — API layer, khớp BE PR #36 (SupplierController).
 *
 * Base URL của env đã gồm `/api/v1` → path không ghi `v1`.
 * Parse tại biên (api-conventions §3.2): zod validate một lần ở đây, map `status` BE ↔ FE.
 */

import { PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";

import { supplierApiDtoSchema, supplierPageSchema } from "./schemas";
import { supplierToFormValues } from "./selectors";

import type { SupplierApiStatus } from "@/constants";
import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";
import type {
  SupplierApiDto,
  SupplierDto,
  SupplierFormValues,
  SupplierStatus,
  SupplierUpdateInput,
} from "./types";

const SUPPLIERS_PATH = "/suppliers";

const API_STATUS: Record<SupplierStatus, SupplierApiStatus> = {
  Active: "ACTIVE",
  Inactive: "INACTIVE",
};

const FE_STATUS: Record<SupplierApiStatus, SupplierStatus> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
};

function toSupplierDto(dto: SupplierApiDto): SupplierDto {
  return { ...dto, status: FE_STATUS[dto.status] };
}

function emptyToNull(value: string): string | null {
  return value === "" ? null : value;
}

/** Body `SaveSupplierRequest` — luôn đủ field vì PUT là thay toàn bộ. */
export function toSaveSupplierRequest(values: SupplierFormValues, status: SupplierStatus) {
  return {
    code: values.code,
    name: values.name,
    contactName: emptyToNull(values.contactName),
    email: emptyToNull(values.email),
    phone: emptyToNull(values.phone),
    taxCode: emptyToNull(values.taxCode),
    status: API_STATUS[status],
    paymentTermDays: values.paymentTermDays,
    leadTimeDays: values.leadTimeDays,
    communicationChannel: values.communicationChannel,
    // Kênh EMAIL không dùng endpoint
    apiEndpoint: values.communicationChannel === "API" ? emptyToNull(values.apiEndpoint) : null,
  };
}

/* ── List ────────────────────────────────────────────────────────────── */

export interface ListSupplierParams extends ListQueryParams {
  /** Trang đánh số từ 0 (BE PageResponse). */
  page?: number;
  size?: number;
  search?: string;
  status?: SupplierStatus[];
  /** `field,asc|desc` — BE chỉ nhận code/name/status/createdAt/lastModifiedAt. */
  sort?: string;
}

export async function listSuppliers(
  params: ListSupplierParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<SupplierDto>> {
  const { page = 0, size = PAGE_SIZE.md, search, status, sort } = params;
  const query = new URLSearchParams({ page: String(Math.max(0, page)), size: String(size) });
  if (search?.trim()) query.set("search", search.trim());
  // BE nhận đúng 1 status; chọn cả hai trạng thái = không lọc
  const onlyStatus = status?.length === 1 ? status[0] : undefined;
  if (onlyStatus) query.set("status", API_STATUS[onlyStatus]);
  if (sort?.trim()) query.set("sort", sort.trim());

  const { data } = await api.get<unknown>(SUPPLIERS_PATH, { params: query, signal });
  const parsed = supplierPageSchema.parse(data);
  return { ...parsed, items: parsed.items.map(toSupplierDto) };
}

/* ── Detail ──────────────────────────────────────────────────────────── */

export async function getSupplier(id: string, signal?: AbortSignal): Promise<SupplierDto> {
  const { data } = await api.get<unknown>(`${SUPPLIERS_PATH}/${encodeURIComponent(id)}`, {
    signal,
  });
  return toSupplierDto(supplierApiDtoSchema.parse(data));
}

/* ── Create / Update ─────────────────────────────────────────────────── */

export async function createSupplier(values: SupplierFormValues): Promise<SupplierDto> {
  const { data } = await api.post<unknown>(SUPPLIERS_PATH, toSaveSupplierRequest(values, "Active"));
  return toSupplierDto(supplierApiDtoSchema.parse(data));
}

export async function updateSupplier({
  id,
  values,
  status,
}: SupplierUpdateInput): Promise<SupplierDto> {
  const { data } = await api.put<unknown>(
    `${SUPPLIERS_PATH}/${encodeURIComponent(id)}`,
    toSaveSupplierRequest(values, status),
  );
  return toSupplierDto(supplierApiDtoSchema.parse(data));
}

/* ── Đổi trạng thái ──────────────────────────────────────────────────── */

/** Kích hoạt lại = PUT đủ field hiện có + status ACTIVE (BE không có endpoint riêng). */
export function activateSupplier(supplier: SupplierDto): Promise<SupplierDto> {
  return updateSupplier({
    id: supplier.supplierId,
    values: supplierToFormValues(supplier),
    status: "Active",
  });
}

/** Ngừng hợp tác = DELETE (BE giữ bản ghi, chuyển INACTIVE; còn PO mở → 409). */
export async function deactivateSupplier(supplier: SupplierDto): Promise<void> {
  await api.delete(`${SUPPLIERS_PATH}/${encodeURIComponent(supplier.supplierId)}`);
}
