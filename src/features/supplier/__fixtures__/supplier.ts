/** Fixture test — đúng hình `SupplierResponse` BE PR #36 (không bịa field ngoài hợp đồng). */

import type { SupplierApiDto, SupplierDto, SupplierFormValues } from "../types";

export const apiSupplier: SupplierApiDto = {
  supplierId: "6f1c2a3b-0000-4000-8000-000000000001",
  code: "SUP-001",
  name: "Công ty TNHH Dệt may Thành Công",
  contactName: "Nguyễn Văn B",
  email: "lienhe@thanhcong.vn",
  phone: "0901234567",
  taxCode: "0301234567",
  status: "ACTIVE",
  paymentTermDays: 30,
  leadTimeDays: 7,
  communicationChannel: "EMAIL",
  apiEndpoint: null,
  createdAt: "2026-09-01T00:00:00Z",
  lastModifiedAt: "2026-09-02T00:00:00Z",
};

export const supplier: SupplierDto = { ...apiSupplier, status: "Active" };

/** NCC nước ngoài — MST chữ-số (mock-data Guangzhou). */
export const foreignSupplier: SupplierDto = {
  ...supplier,
  supplierId: "6f1c2a3b-0000-4000-8000-000000000002",
  code: "SUP-002",
  name: "Guangzhou Textile Co., Ltd",
  taxCode: "91440101MA5XXXXX",
  phone: "+86 20 1234 5678",
};

export const validFormValues: SupplierFormValues = {
  code: "SUP-009",
  name: "Công ty A",
  taxCode: "0301234567",
  contactName: "Nguyễn Văn B",
  email: "b@a.vn",
  phone: "0901234567",
  paymentTermDays: 30,
  leadTimeDays: 7,
  communicationChannel: "EMAIL",
  apiEndpoint: "",
};

export function apiPage(items: SupplierApiDto[] = [apiSupplier]) {
  return {
    items,
    page: 0,
    size: 15,
    totalElements: items.length,
    totalPages: items.length ? 1 : 0,
    hasNext: false,
    hasPrevious: false,
  };
}
