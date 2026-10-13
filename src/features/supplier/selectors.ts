/**
 * Supplier — selectors thuần (không side effect).
 */

import type { SupplierDto, SupplierFormValues } from "./types";

/** Giá trị mặc định khi tạo NCC mới — BE CommercialTerms mặc định khi bỏ trống (PR #36). */
export const SUPPLIER_FORM_DEFAULTS: SupplierFormValues = {
  code: "",
  name: "",
  taxCode: "",
  contactName: "",
  email: "",
  phone: "",
  paymentTermDays: 30,
  leadTimeDays: 7,
  communicationChannel: "EMAIL",
  apiEndpoint: "",
  overReceiptTolerancePercent: null,
  printSubcontractor: false,
  lossTolerancePercent: null,
};

/** DTO → giá trị form (dùng cho trang sửa và cho PUT kích hoạt lại). */
export function supplierToFormValues(supplier: SupplierDto): SupplierFormValues {
  return {
    code: supplier.code,
    name: supplier.name,
    taxCode: supplier.taxCode ?? "",
    contactName: supplier.contactName ?? "",
    email: supplier.email ?? "",
    phone: supplier.phone ?? "",
    paymentTermDays: supplier.paymentTermDays,
    leadTimeDays: supplier.leadTimeDays,
    communicationChannel: supplier.communicationChannel,
    apiEndpoint: supplier.apiEndpoint ?? "",
    overReceiptTolerancePercent: supplier.overReceiptTolerancePercent ?? null,
    printSubcontractor: supplier.printSubcontractor,
    lossTolerancePercent: supplier.lossTolerancePercent ?? null,
  };
}
