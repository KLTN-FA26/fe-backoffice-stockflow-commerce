/**
 * Mock route — hồ sơ pháp lý của khách, đúng BE `CustomerLegalProfileController`
 * (`/customers/{customerId}/legal-profile`): `GET` (404 `LEGAL_PROFILE_NOT_FOUND` khi chưa có) và `PUT` lưu cả hồ sơ một
 * lần, kiểm `version` (lần đầu `null` / -1; lệch → 409 `OPTIMISTIC_LOCK`). Lỗi dữ liệu là 400 `VALIDATION_FAILED` KHÔNG kèm
 * `fieldErrors`, câu tiếng Anh như BE. Quyền `customer-legal-profiles:READ` / `UPDATE`.
 */

import { CUSTOMER_LEGAL_PROFILE_PERMISSIONS } from "@/constants";

import { registerMockRoute } from "./mock-adapter";
import { findMockCustomer } from "./mock-customer-store";
import { legalProfileOf, saveLegalProfile } from "./mock-legal-profile-store";
import { refuse, guarded } from "./mock-quote-refusal";
import { hasMockPermission } from "./mock-routes-order-schedule";
import { bodyOf, fail, ok, pathParams, text } from "./mock-route-utils";

import type { AxiosRequestConfig } from "axios";
import type { MockBankAccount, MockLegalProfile } from "./mock-legal-profile-store";

const PATH = "/customers/:customerId/legal-profile";
const BANK_ACCOUNT_NUMBER = /^[0-9A-Za-z]{4,34}$/;
const INVOICE_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const forbidden = () => fail(403, "FORBIDDEN", "Access denied");
const invalid = (message: string): never => refuse(400, "VALIDATION_FAILED", message);

function required(body: Record<string, unknown>, field: string, max: number): string {
  const value = text(body[field]);
  if (!value || value.length > max) invalid(`${field}: required, at most ${max} characters`);
  return value;
}

function bankOf(raw: unknown): MockBankAccount | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object") return invalid("bankAccount: invalid");
  const bank = raw as Record<string, unknown>;
  const accountNumber = text(bank.accountNumber);
  const bankName = text(bank.bankName);
  const accountHolder = text(bank.accountHolder);
  if (!accountNumber && !bankName && !accountHolder) return null;
  if (!BANK_ACCOUNT_NUMBER.test(accountNumber.replace(/[\s.-]/g, "")))
    invalid("bankAccount.accountNumber: 4-34 letters or digits");
  if (!bankName || bankName.length > 200)
    invalid("bankAccount.bankName: required, at most 200 characters");
  if (!accountHolder || accountHolder.length > 200)
    invalid("bankAccount.accountHolder: required, at most 200 characters");
  return { accountNumber, bankName, accountHolder };
}

function toResponse(customerId: string, profile: MockLegalProfile) {
  const customer = findMockCustomer(customerId);
  return ok({
    customerId: customerId.toLowerCase(),
    companyName: customer?.fullName ?? "",
    taxCode: customer?.taxCode ?? null,
    ...profile,
  });
}

const customerIdOf = (config: AxiosRequestConfig) => pathParams(config).customerId ?? "";

export function registerLegalProfileMockRoutes(): void {
  registerMockRoute(
    "GET",
    PATH,
    guarded(async (config) => {
      if (!(await hasMockPermission(CUSTOMER_LEGAL_PROFILE_PERMISSIONS.read))) return forbidden();
      const id = customerIdOf(config);
      if (!findMockCustomer(id)) return fail(404, "CUSTOMER_NOT_FOUND", "Customer not found");
      const profile = legalProfileOf(id);
      return profile
        ? toResponse(id, profile)
        : fail(404, "LEGAL_PROFILE_NOT_FOUND", "Legal profile not found");
    }),
  );
  registerMockRoute(
    "PUT",
    PATH,
    guarded(async (config) => {
      if (!(await hasMockPermission(CUSTOMER_LEGAL_PROFILE_PERMISSIONS.update))) return forbidden();
      const id = customerIdOf(config);
      if (!findMockCustomer(id)) return fail(404, "CUSTOMER_NOT_FOUND", "Customer not found");
      const body = bodyOf(config);
      const next: Omit<MockLegalProfile, "version"> = {
        registeredAddress: required(body, "registeredAddress", 500),
        representativeName: required(body, "representativeName", 200),
        representativeTitle: required(body, "representativeTitle", 100),
        invoiceEmail: (() => {
          const email = text(body.invoiceEmail).toLowerCase();
          if (!email) return null;
          if (email.length > 320 || !INVOICE_EMAIL.test(email))
            invalid("invoiceEmail: not a valid email, at most 320 characters");
          return email;
        })(),
        bankAccount: bankOf(body.bankAccount),
      };
      const current = legalProfileOf(id);
      const sent = typeof body.version === "number" ? body.version : null;
      const firstSave = sent === null || sent === -1;
      if (current ? sent !== current.version : !firstSave)
        refuse(409, "OPTIMISTIC_LOCK", "The record changed meanwhile, please retry");
      const profile = { ...next, version: current ? current.version + 1 : 0 };
      saveLegalProfile(id, profile);
      return toResponse(id, profile);
    }),
  );
}
