/**
 * Khách hàng B2B — API layer (BE local integration d215f6e, chưa merge develop).
 * Parse tại biên (api-conventions §3.2); envelope `{success,data}` đã được interceptor bóc.
 */

import { AUTH_API_BASE } from "@/constants/auth";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import {
  creditProfileDtoSchema,
  customerDtoSchema,
  customerPageDtoSchema,
  customerStatusHistoryDtoSchema,
  invitedCustomerDtoSchema,
  legalProfileDtoSchema,
  normalizeTaxCode,
  portalActivationDtoSchema,
  portalInvitationDtoSchema,
} from "./schemas";

import type { CustomerApiStatus } from "@/constants";
import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";
import type {
  CreditProfile,
  Customer,
  CustomerCreateValues,
  CustomerStatusEntry,
  CustomerUpdateValues,
  InvitedCustomer,
  LegalProfile,
  LegalProfileValues,
  PortalInvitation,
} from "./types";

const CUSTOMERS = "/customers";
const byId = (id: string) => `${CUSTOMERS}/${encodeURIComponent(id)}`;

export interface ListCustomerParams extends ListQueryParams {
  page?: number;
  size?: number;
  q?: string;
  /** BE nhận MỘT trạng thái (`CustomerStatus.valueOf`, phân biệt hoa thường). */
  status?: CustomerApiStatus;
  /** `fullName|email|createdAt|status[,asc|desc]`. */
  sort?: string;
}

export async function listCustomers(
  params: ListCustomerParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<Customer>> {
  const query = new URLSearchParams({
    page: String(Math.max(0, params.page ?? 0)),
    size: String(params.size ?? 15),
  });
  if (params.q?.trim()) query.set("q", params.q.trim());
  if (params.status) query.set("status", params.status);
  if (params.sort) query.set("sort", params.sort);
  const { data } = await api.get<unknown>(CUSTOMERS, { params: query, signal });
  return customerPageDtoSchema.parse(data);
}

export async function getCustomer(id: string, signal?: AbortSignal): Promise<Customer> {
  const { data } = await api.get<unknown>(byId(id), { signal });
  return customerDtoSchema.parse(data);
}

export async function getCustomerStatusHistory(
  id: string,
  signal?: AbortSignal,
): Promise<CustomerStatusEntry[]> {
  const { data } = await api.get<unknown>(`${byId(id)}/status-history`, { signal });
  return customerStatusHistoryDtoSchema.parse(data);
}

export async function getPortalInvitation(
  id: string,
  signal?: AbortSignal,
): Promise<PortalInvitation> {
  const { data } = await api.get<unknown>(`${byId(id)}/portal-invitation`, { signal });
  return portalInvitationDtoSchema.parse(data);
}

export async function getCreditProfile(id: string, signal?: AbortSignal): Promise<CreditProfile> {
  const { data } = await api.get<unknown>(`${byId(id)}/credit-profile`, { signal });
  return creditProfileDtoSchema.parse(data);
}

/** `null` = khách chưa có hồ sơ pháp lý (404 `LEGAL_PROFILE_NOT_FOUND`); khách không tồn tại vẫn ném lỗi. */
export async function getLegalProfile(
  id: string,
  signal?: AbortSignal,
): Promise<LegalProfile | null> {
  try {
    const { data } = await api.get<unknown>(`${byId(id)}/legal-profile`, { signal });
    return legalProfileDtoSchema.parse(data);
  } catch (error) {
    if (error instanceof ApiError && error.code === "LEGAL_PROFILE_NOT_FOUND") return null;
    throw error;
  }
}

export interface SaveLegalProfileInput {
  id: string;
  /** `null` = lần lưu đầu (chưa có hồ sơ); đã có hồ sơ thì gửi version đang xem. */
  version: number | null;
  values: LegalProfileValues;
}

/** `PUT /customers/{id}/legal-profile` — lưu cả hồ sơ một lần; ba ô ngân hàng trống = không có tài khoản. */
export async function saveLegalProfile({
  id,
  version,
  values,
}: SaveLegalProfileInput): Promise<LegalProfile> {
  const body = {
    registeredAddress: values.registeredAddress.trim(),
    representativeName: values.representativeName.trim(),
    representativeTitle: values.representativeTitle.trim(),
    ...(values.invoiceEmail.trim() ? { invoiceEmail: values.invoiceEmail.trim() } : {}),
    ...(values.accountNumber.trim()
      ? {
          bankAccount: {
            accountNumber: values.accountNumber.trim(),
            bankName: values.bankName.trim(),
            accountHolder: values.accountHolder.trim(),
          },
        }
      : {}),
    version,
  };
  const { data } = await api.put<unknown>(`${byId(id)}/legal-profile`, body);
  return legalProfileDtoSchema.parse(data);
}

/**
 * `POST /customers` → 201 khách PENDING_ACTIVATION + lời mời (link KHÔNG bao giờ trả về). Trường mới của sales-owner
 * (`taxCodeExemption` + `taxCodeExemptionReason`, `salesOwnerId`, `leadId`) chỉ gửi khi có giá trị — body cũ không đổi.
 */
export async function createCustomer(values: CustomerCreateValues): Promise<InvitedCustomer> {
  const body = {
    companyName: values.companyName.trim(),
    contactName: values.contactName.trim(),
    email: values.email.trim(),
    ...(values.taxCode.trim() ? { taxCode: normalizeTaxCode(values.taxCode) } : {}),
    ...(values.phone.trim() ? { phone: values.phone.trim() } : {}),
    // BR-S14: miễn MST (Sales Manager) — chỉ gửi khi miễn và thật sự không có MST.
    ...(values.taxCodeExemption && !values.taxCode.trim()
      ? { taxCodeExemption: true, taxCodeExemptionReason: values.exemptionReason.trim() }
      : {}),
    // BR-S02: Manager chọn Sale phụ trách; §10.7: tạo từ khách tiềm năng.
    ...(values.salesOwnerId ? { salesOwnerId: values.salesOwnerId } : {}),
    ...(values.leadId ? { leadId: values.leadId } : {}),
  };
  const { data } = await api.post<unknown>(CUSTOMERS, body);
  return invitedCustomerDtoSchema.parse(data);
}

export interface UpdateCustomerInput {
  id: string;
  version: number;
  values: CustomerUpdateValues;
}

/** `PUT /customers/{id}` — MST rỗng = giữ nguyên (BE không cho xoá MST đã có). */
export async function updateCustomer({
  id,
  version,
  values,
}: UpdateCustomerInput): Promise<Customer> {
  const body = {
    fullName: values.fullName.trim(),
    phone: values.phone.trim() || null,
    version,
    ...(values.taxCode.trim() ? { taxCode: normalizeTaxCode(values.taxCode) } : {}),
  };
  const { data } = await api.put<unknown>(byId(id), body);
  return customerDtoSchema.parse(data);
}

export interface ChangeCustomerStatusInput {
  id: string;
  status: Exclude<CustomerApiStatus, "PENDING_ACTIVATION">;
  reason?: string;
}

export async function changeCustomerStatus({
  id,
  status,
  reason,
}: ChangeCustomerStatusInput): Promise<Customer> {
  const { data } = await api.post<unknown>(`${byId(id)}/status`, {
    status,
    ...(reason?.trim() ? { reason: reason.trim() } : {}),
  });
  return customerDtoSchema.parse(data);
}

/** Gửi lại lời mời — link cũ hết hiệu lực; cooldown 1 phút (429). */
export async function resendPortalInvitation(id: string): Promise<InvitedCustomer> {
  const { data } = await api.post<unknown>(`${byId(id)}/portal-invitation`);
  return invitedCustomerDtoSchema.parse(data);
}

/**
 * Kích hoạt tài khoản portal — route BFF công khai `/api/auth/portal-activation` (không phiên).
 * Trả email để khách đăng nhập; KHÔNG cấp phiên (khách tự đăng nhập bằng mật khẩu vừa đặt).
 */
export async function activatePortalAccount(input: {
  token: string;
  password: string;
}): Promise<{ email: string }> {
  const { data } = await api.post<unknown>("/auth/portal-activation", input, {
    baseURL: AUTH_API_BASE,
  });
  return portalActivationDtoSchema.parse(data);
}
