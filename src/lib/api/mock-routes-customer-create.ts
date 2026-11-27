/**
 * Mock route — `POST /customers` (BE `CustomerOnboardingService.create`), chỉ USE_MOCK=true. Luật theo BE:
 * - BR-S14 / D4: MST bắt buộc (400 `CUSTOMER_TAX_CODE_REQUIRED`), trừ khi người điều phối miễn kèm lý do;
 * - một khách chờ kích hoạt / đang hoạt động cho mỗi MST, mỗi email (409);
 * - người phụ trách (BR-S02, §10.7, chốt 28/11 — khách mới luôn có người phụ trách): lead → Sale của lead
 *   (`LEAD_CONVERTED`); Sale tạo → chính họ (`CREATED_BY_SALES`); người điều phối (`customer-sales-owners:UPDATE`) phải
 *   chọn một Sale (400 `SALES_OWNER_REQUIRED`); người được chọn không phải Sale đang làm → 422
 *   `SALES_OWNER_NOT_ASSIGNABLE`;
 * - BR-S12 (review P4): Sale (không phải người điều phối) tạo một đơn vị của tổ chức mà Sale khác đang phụ trách (cùng MST
 *   gốc 10 số, khác MST) → 409 `CUSTOMER_OWNED_BY_OTHER_SALES` kèm `details.salesOwnerName`.
 * Khách mới vào `mock-customer-store` (PENDING_ACTIVATION) và store người phụ trách, nên thấy ngay ở danh sách / thẻ khách.
 */

import { CUSTOMER_PERMISSIONS } from "@/constants";
import { SALES_OWNER_ERROR_CODES, SALES_OWNER_PERMISSIONS } from "@/constants/sales-owner";

import { registerMockRoute } from "./mock-adapter";
import { chatCaller } from "./mock-chat-store";
import { addMockCustomer, allMockCustomers, normaliseTaxCode } from "./mock-customer-store";
import { ownerView } from "./mock-routes-sales-owner";
import { mockLead } from "./mock-routes-sales-work";
import { bodyOf, fail, ok, text, validationFailed } from "./mock-route-utils";
import { taxCodeRoot } from "./mock-tax-code";
import {
  callerWith,
  mockSalesId,
  mockSalesRoster,
  moveOwner,
  salesOwnerStore,
} from "./mock-sales-owner-store";

import type { AxiosRequestConfig } from "axios";

/** BE: lời mời kích hoạt hết hạn sau 72 giờ. */
const INVITATION_HOURS = 72;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const forbidden = (message: string) => fail(403, "FORBIDDEN", message);

/** Người phụ trách đầu tiên, hoặc lỗi của BE — cùng thứ tự kiểm như `CustomerOnboardingService.firstOwner`. */
async function firstOwner(
  body: Record<string, unknown>,
  caller: string,
  manager: boolean,
): Promise<{ ownerId: string; reason: string; leadId: string | null } | ReturnType<typeof fail>> {
  const named = text(body.salesOwnerId);
  const leadId = text(body.leadId);
  if (leadId) {
    const lead = await mockLead(leadId);
    if (!lead) return fail(404, "LEAD_NOT_FOUND", "Lead not found");
    if (lead.status === "CONVERTED" || lead.status === "DISQUALIFIED")
      return fail(409, "LEAD_ALREADY_HANDLED", "This lead was already handled");
    if (!lead.assignedTo) return fail(409, "LEAD_NOT_ASSIGNED", "This lead has no salesperson yet");
    if (lead.assignedTo !== caller && !manager)
      return forbidden("Only the lead's salesperson or a manager converts it");
    if (named && named !== lead.assignedTo)
      return validationFailed(
        "salesOwnerId",
        "A customer made from a lead is looked after by the lead's salesperson",
      );
    return { ownerId: lead.assignedTo, reason: "LEAD_CONVERTED", leadId };
  }
  if (named) {
    if (!manager && named !== caller)
      return forbidden(
        "Only a Sales Manager chooses another salesperson to look after a new customer",
      );
    return { ownerId: named, reason: "CREATED_BY_SALES", leadId: null };
  }
  const roster = await mockSalesRoster();
  if (!manager && roster.some((p) => p.id === caller))
    return { ownerId: caller, reason: "CREATED_BY_SALES", leadId: null };
  return fail(
    400,
    "SALES_OWNER_REQUIRED",
    "Choose the salesperson who will look after this customer",
  );
}

async function createRoute(config: AxiosRequestConfig) {
  const caller = await callerWith(CUSTOMER_PERMISSIONS.create);
  if (typeof caller !== "string") return caller;
  const manager = (await chatCaller())?.can(SALES_OWNER_PERMISSIONS.update) ?? false;
  const body = bodyOf(config);
  const companyName = text(body.companyName);
  const contactName = text(body.contactName);
  const email = text(body.email).toLowerCase();
  if (!companyName) return validationFailed("companyName", "must not be blank");
  if (!contactName) return validationFailed("contactName", "must not be blank");
  if (!EMAIL.test(email)) return validationFailed("email", "must be a well-formed email address");
  const rawTaxCode = text(body.taxCode);
  const taxCode = rawTaxCode ? normaliseTaxCode(rawTaxCode) : null;
  if (rawTaxCode && !taxCode) return validationFailed("taxCode", "taxCode is malformed");
  const exempted = body.taxCodeExemption === true;
  if (taxCode && exempted)
    return fail(400, "VALIDATION_FAILED", "An exemption is for a customer without a tax code");
  if (!taxCode) {
    if (!exempted) return fail(400, "CUSTOMER_TAX_CODE_REQUIRED", "The tax code is required");
    if (!manager) return forbidden("Only a Sales Manager creates a customer without a tax code");
    if (!text(body.taxCodeExemptionReason))
      return fail(400, "VALIDATION_FAILED", "Say why the customer has no tax code");
  }
  const live = allMockCustomers().filter(
    (c) => c.status === "PENDING_ACTIVATION" || c.status === "ACTIVE",
  );
  if (taxCode && live.some((c) => c.taxCode === taxCode))
    return fail(
      409,
      "CUSTOMER_TAX_CODE_ALREADY_EXISTS",
      "A customer with this tax code already exists",
    );
  if (allMockCustomers().some((c) => c.email.toLowerCase() === email))
    return fail(
      409,
      "CUSTOMER_EMAIL_ALREADY_EXISTS",
      "A customer account with this email already exists",
    );
  const owner = await firstOwner(body, caller, manager);
  if ("status" in owner) return owner;
  const roster = await mockSalesRoster();
  if (!roster.some((p) => p.id === owner.ownerId))
    return fail(422, "SALES_OWNER_NOT_ASSIGNABLE", "This person cannot look after customers");
  // P4: một đơn vị khác của cùng tổ chức đã có Sale đang làm khác phụ trách → chỉ người đó hoặc quản lý tạo
  const root = taxCode ? taxCodeRoot(taxCode) : null;
  if (root && !manager) {
    for (const related of live.filter((c) => c.taxCode && taxCodeRoot(c.taxCode) === root)) {
      const view = await ownerView(related.customerId);
      if (
        view?.state === "ASSIGNED" &&
        view.salesOwnerId &&
        view.salesOwnerId !== owner.ownerId &&
        roster.some((p) => p.id === view.salesOwnerId)
      )
        return fail(
          409,
          SALES_OWNER_ERROR_CODES.ownedByOther,
          `Khách này do ${view.salesOwnerName ?? "Sale khác"} phụ trách.`,
          [],
          { salesOwnerId: view.salesOwnerId, salesOwnerName: view.salesOwnerName },
        );
    }
  }

  const now = new Date();
  const customer = {
    customerId: mockSalesId("c0de9000"),
    userId: mockSalesId("0e5e9000"),
    fullName: companyName,
    email,
    phone: text(body.phone) || null,
    taxCode,
    segmentId: null,
    status: "PENDING_ACTIVATION" as const,
    version: 0,
    createdAt: now.toISOString(),
  };
  addMockCustomer(customer);
  moveOwner(await salesOwnerStore(), customer.customerId, owner.ownerId, {
    reason: owner.reason,
    note: null,
    changedById: caller,
    batchId: null,
  });
  if (owner.leadId) {
    const lead = await mockLead(owner.leadId);
    if (lead) {
      lead.status = "CONVERTED";
      lead.customerId = customer.customerId;
    }
  }
  return ok(
    {
      customer,
      invitation: {
        issuedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + INVITATION_HOURS * 3_600_000).toISOString(),
        delivery: "SENT",
      },
    },
    201,
  );
}

export function registerCustomerCreateMockRoute(): void {
  registerMockRoute("POST", "/customers", createRoute);
}
