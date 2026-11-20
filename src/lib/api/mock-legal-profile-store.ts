/**
 * Mock hồ sơ pháp lý của khách (BE `customer.customer_legal_profile`, `CustomerLegalProfileService`). Hai khách seed WF-02
 * (khách demo, Trà Sữa Mây) đã có hồ sơ; mọi khách khác chưa có → lập hợp đồng bị 409 `CUSTOMER_LEGAL_PROFILE_MISSING` cho
 * tới khi Sale lưu hồ sơ (PUT) — nên hợp đồng mock dựa vào `legalBuyerOf`, không đọc thẳng seed.
 */

import { findMockCustomer } from "./mock-customer-store";
import { wf02Customer } from "./mock-quote-seed";

import type { Wf02Party } from "./mock-quote-seed";

export interface MockBankAccount {
  accountNumber: string;
  bankName: string;
  accountHolder: string;
}

export interface MockLegalProfile {
  registeredAddress: string;
  representativeName: string;
  representativeTitle: string;
  invoiceEmail: string | null;
  bankAccount: MockBankAccount | null;
  version: number;
}

/** Hồ sơ đã lưu qua PUT (khoá = customerId chữ thường). Hồ sơ seed không nằm ở đây cho tới khi bị sửa. */
const saved = new Map<string, MockLegalProfile>();

export function resetLegalProfileMockStore(): void {
  saved.clear();
}

export function legalProfileOf(customerId: string): MockLegalProfile | null {
  const id = customerId.toLowerCase();
  const stored = saved.get(id);
  if (stored) return stored;
  const seed = wf02Customer(id)?.buyer;
  if (!seed?.address || !seed.representative) return null;
  return {
    registeredAddress: seed.address,
    representativeName: seed.representative,
    representativeTitle: seed.representativeTitle ?? "",
    invoiceEmail: null,
    bankAccount: null,
    version: 0,
  };
}

export function saveLegalProfile(customerId: string, profile: MockLegalProfile): void {
  saved.set(customerId.toLowerCase(), profile);
}

/** Bên mua của hợp đồng: tên + MST theo khách, phần còn lại theo hồ sơ pháp lý; `undefined` = chưa có hồ sơ. */
export function legalBuyerOf(customerId: string): Wf02Party | undefined {
  const profile = legalProfileOf(customerId);
  if (!profile) return undefined;
  const customer = findMockCustomer(customerId);
  return {
    name: customer?.fullName ?? "",
    taxCode: customer?.taxCode ?? null,
    address: profile.registeredAddress,
    representative: profile.representativeName,
    representativeTitle: profile.representativeTitle,
  };
}
