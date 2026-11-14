/**
 * Mock route hoá đơn điện tử — khớp BE `EInvoiceController` / `EInvoiceSettingsController` (docs 21):
 *   GET  /einvoices?status&type&orderId&customerId&issuedFrom&issuedTo&dueBefore&page&size
 *   GET  /einvoices/{id} · /provider-calls · /files/{kind} · /corrections · /error-notices · /agreement
 *   POST /einvoices · /{id}/buyer-refresh · /void · /reopening · /issuance · /resubmission · /reconciliation
 *   PUT  /einvoices/{id} · /{id}/agreement
 *   POST /einvoices/{id}/adjustments · /replacements · /error-notices · /error-notices/{nid}/sending
 *   GET  /einvoices/register?from&to · /register/export
 *   GET|PUT /einvoice-settings · GET /providers · PUT /providers/{p}/account|series · POST /activation
 * Phát hành là bất đồng bộ: `issuance` trả SUBMITTING; lần đọc sau ≥ 2 giây (hoặc `reconciliation`) ra ISSUED.
 */

import { EINVOICE_PERMISSIONS, EINVOICE_SETTINGS_PERMISSIONS } from "@/constants/einvoice";

import { registerMockRoute } from "./mock-adapter";
import {
  MOCK_SELLER,
  MOCK_TEMPLATE,
  lineAmount,
  lineTax,
  mockEInvoiceSettings,
  mockEInvoices,
  mockErrorNotices,
  nextEInvoiceId,
  nextInvoiceNumber,
  nextNoticeId,
  setMockEInvoiceSettings,
} from "./mock-einvoice-store";
import { can } from "./mock-routes-payment";
import {
  bodyOf,
  fail,
  ok,
  optimisticLock,
  pageOf,
  pathParams,
  queryOf,
  text,
} from "./mock-route-utils";

import type { AxiosRequestConfig } from "axios";
import type { PermissionCode } from "@/lib/auth/me-permissions";
import type { MockEInvoice } from "./mock-einvoice-store";

const P = EINVOICE_PERMISSIONS;
const forbidden = () => fail(403, "FORBIDDEN", "Forbidden");
const notFound = () => fail(404, "EINVOICE_NOT_FOUND", "E-invoice not found");
const transition = () => fail(409, "EINVOICE_INVALID_TRANSITION", "The status does not allow this");
const SUBMIT_MS = 2_000;
const nowIso = () => new Date().toISOString();

const byId = (id: string) => mockEInvoices().find((i) => i.id === id);

/** Phát hành mock: đã gửi đủ lâu → ISSUED, có số và tệp (docs 21 §4.2 bước 6). */
function settle(invoice: MockEInvoice, force = false) {
  if (invoice.status !== "SUBMITTING" || invoice.warnings.includes("UNKNOWN_TO_PROVIDER")) return;
  const sent = Date.parse(invoice.submittedAt ?? nowIso());
  if (!force && Date.now() - sent < SUBMIT_MS) return;
  invoice.status = "ISSUED";
  invoice.invoiceNumber = nextInvoiceNumber();
  invoice.symbol = mockEInvoiceSettings().series[0]?.symbol ?? null;
  invoice.issuedAt = nowIso();
  invoice.version += 1;
  if (invoice.type === "REPLACEMENT" && invoice.originalEInvoiceId) {
    const original = byId(invoice.originalEInvoiceId);
    if (original) original.status = "REPLACED";
  }
  if (invoice.type === "ADJUSTMENT" && invoice.originalEInvoiceId) {
    const original = byId(invoice.originalEInvoiceId);
    if (original) original.adjusted = true;
  }
}

const overdue = (i: MockEInvoice) =>
  (i.status === "DRAFT" || i.status === "SUBMITTING" || i.status === "REJECTED") &&
  Date.parse(i.issueDueAt) < Date.now();

const totals = (i: MockEInvoice) => {
  const subtotal = i.lines.reduce((sum, line) => sum + lineAmount(line), 0);
  const taxTotal = i.lines.reduce((sum, line) => sum + lineTax(line), 0);
  return { subtotal, taxTotal, grandTotal: subtotal + taxTotal };
};

function listItem(i: MockEInvoice) {
  return {
    id: i.id,
    code: i.code,
    type: i.type,
    status: i.status,
    adjusted: i.adjusted,
    orderId: i.orderId,
    orderNumber: i.orderNumber,
    shipmentId: i.shipmentId,
    shipmentCode: i.shipmentCode,
    customerId: i.customerId,
    buyerName: i.buyer.name,
    buyerTaxCode: i.buyer.taxCode,
    issueDate: i.issueDate,
    issueDueAt: i.issueDueAt,
    overdue: overdue(i),
    templateCode: i.invoiceNumber ? MOCK_TEMPLATE : null,
    symbol: i.symbol,
    invoiceNumber: i.invoiceNumber,
    ...totals(i),
    warnings: i.warnings,
    rejectionCode: i.rejectionCode,
    issuedAt: i.issuedAt,
  };
}

function detail(i: MockEInvoice) {
  const earlier = mockEInvoices().find(
    (o) =>
      o.id !== i.id && o.status === "DRAFT" && i.status === "DRAFT" && o.issueDate < i.issueDate,
  );
  const byRate = new Map<number, { amount: number; taxAmount: number }>();
  for (const line of i.lines) {
    const row = byRate.get(line.taxRate) ?? { amount: 0, taxAmount: 0 };
    row.amount += lineAmount(line);
    row.taxAmount += lineTax(line);
    byRate.set(line.taxRate, row);
  }
  return {
    ...listItem(i),
    contractNumber: i.contractNumber,
    originalEInvoiceId: i.originalEInvoiceId,
    provider: mockEInvoiceSettings().provider,
    seller: MOCK_SELLER,
    buyer: i.buyer,
    currency: "VND",
    paymentMethod: "BANK_TRANSFER",
    lines: i.lines.map((line) => ({ ...line, amount: lineAmount(line), taxAmount: lineTax(line) })),
    totalsByRate: [...byRate].map(([taxRate, row]) => ({ taxRate, ...row })),
    warnings: earlier ? [...i.warnings, "EARLIER_INVOICE_PENDING"] : i.warnings,
    rejectionMessage: i.rejectionMessage,
    submittedAt: i.submittedAt,
    voidedAt: i.voidedAt,
    voidReason: i.voidReason,
    hasFiles: i.status === "ISSUED" || i.status === "REPLACED",
    version: i.version,
    correctionBasis: i.correctionBasis,
    correctionReason: i.correctionReason,
    agreementRequired: i.correctionBasis === "ERROR" && i.status === "DRAFT",
    agreement: i.agreement,
    returnRequestId: i.returnRequestId,
    earlierPendingInvoice: earlier?.code ?? null,
  };
}

function list(config: AxiosRequestConfig) {
  const q = queryOf(config);
  const due = q.get("dueBefore");
  const rows = mockEInvoices()
    .map((i) => (settle(i), i))
    .filter(
      (i) =>
        (!q.get("status") || i.status === q.get("status")) &&
        (!q.get("type") || i.type === q.get("type")) &&
        (!q.get("orderId") || i.orderId === q.get("orderId")) &&
        (!q.get("customerId") || i.customerId === q.get("customerId")) &&
        (!q.get("issuedFrom") || i.issueDate >= (q.get("issuedFrom") ?? "")) &&
        (!q.get("issuedTo") || i.issueDate <= (q.get("issuedTo") ?? "")) &&
        (!due || (!i.issuedAt && i.status !== "VOIDED_DRAFT" && i.issueDueAt < due)),
    )
    // Còn phải phát hành trước, hạn gần nhất trước (BE EInvoiceQueries)
    .sort(
      (a, b) =>
        Number(!!a.issuedAt) - Number(!!b.issuedAt) || a.issueDueAt.localeCompare(b.issueDueAt),
    );
  const page = Number(q.get("page") ?? 0);
  const size = Number(q.get("size") ?? 15);
  return pageOf(rows.map(listItem), page, size);
}

type Handler = (invoice: MockEInvoice, body: Record<string, unknown>) => ReturnType<typeof ok>;

/** Thao tác có khoá lạc quan: `version` phải trùng (BE 409 OPTIMISTIC_LOCK). */
function versioned(permission: string, handler: Handler) {
  return async (config: AxiosRequestConfig) => {
    if (!(await can(permission as PermissionCode))) return forbidden();
    const invoice = byId(pathParams(config).id ?? "");
    if (!invoice) return notFound();
    const body = bodyOf(config);
    if (body.version !== undefined && Number(body.version) !== invoice.version)
      return optimisticLock();
    return handler(invoice, body);
  };
}

const touch = (invoice: MockEInvoice) => {
  invoice.version += 1;
  return ok(detail(invoice));
};

export function registerEInvoiceMockRoutes(): void {
  registerMockRoute("GET", "/einvoices", async (config) =>
    (await can(P.read)) ? ok(list(config)) : forbidden(),
  );
  registerMockRoute("GET", "/einvoices/register", async (config) => {
    if (!(await can(P.read))) return forbidden();
    const q = queryOf(config);
    const rows = mockEInvoices().filter(
      (i) =>
        i.invoiceNumber !== null &&
        i.issueDate >= (q.get("from") ?? "") &&
        i.issueDate <= (q.get("to") ?? "9999"),
    );
    return ok(
      rows.map((i) => ({
        ...listItem(i),
        templateCode: MOCK_TEMPLATE,
        buyerAddress: i.buyer.address,
        originalReference: i.originalEInvoiceId,
        totalsByRate: detail(i).totalsByRate,
      })),
    );
  });
  registerMockRoute("GET", "/einvoices/register/export", async () =>
    (await can(P.export))
      ? { status: 200, data: new Blob(["﻿Ký hiệu,Số\n"]), headers: {} }
      : forbidden(),
  );
  registerMockRoute("GET", "/einvoices/:id", async (config) => {
    if (!(await can(P.read))) return forbidden();
    const invoice = byId(pathParams(config).id ?? "");
    if (!invoice) return notFound();
    settle(invoice);
    return ok(detail(invoice));
  });
  registerMockRoute("GET", "/einvoices/:id/provider-calls", async (config) => {
    const invoice = byId(pathParams(config).id ?? "");
    if (!invoice) return notFound();
    const calls = invoice.submittedAt
      ? [
          {
            provider: "SANDBOX",
            transactionId: `TX-${invoice.code}`,
            operation: "SUBMIT",
            outcome: invoice.status === "REJECTED" ? "REJECTED" : "ACCEPTED",
            httpStatus: 200,
            calledAt: invoice.submittedAt,
            durationMs: 420,
          },
        ]
      : [];
    return ok(calls);
  });
  registerMockRoute("GET", "/einvoices/:id/files/:kind", async (config) => {
    const invoice = byId(pathParams(config).id ?? "");
    if (!invoice) return notFound();
    if (!invoice.issuedAt)
      return fail(409, "EINVOICE_NOT_ISSUED", "The e-invoice is not issued yet");
    return ok({
      url: `https://files.example/${invoice.code}.${(pathParams(config).kind ?? "pdf").toLowerCase()}`,
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    });
  });
  registerMockRoute("GET", "/einvoices/:id/corrections", async (config) => {
    const id = pathParams(config).id ?? "";
    return ok(
      mockEInvoices()
        .filter((i) => i.originalEInvoiceId === id)
        .map(listItem),
    );
  });
  registerMockRoute("POST", "/einvoices", async (config) => {
    if (!(await can(P.create))) return forbidden();
    const body = bodyOf(config);
    const existing = mockEInvoices().find(
      (i) =>
        i.orderId === text(body.orderId) &&
        i.shipmentId === (text(body.shipmentId) || null) &&
        i.status !== "VOIDED_DRAFT",
    );
    if (existing) return ok(detail(existing));
    return fail(
      409,
      "EINVOICE_NOT_INVOICEABLE",
      "This shipment cannot be invoiced: it is not delivered",
    );
  });
  registerMockRoute(
    "PUT",
    "/einvoices/:id",
    versioned(P.update, (i, body) => {
      if (i.status !== "DRAFT")
        return fail(409, "EINVOICE_NOT_DRAFT", "Only a draft e-invoice can be changed");
      i.buyer = {
        name: text(body.buyerName) || i.buyer.name,
        taxCode: text(body.buyerTaxCode) || i.buyer.taxCode,
        address: text(body.buyerAddress) || i.buyer.address,
        email: text(body.buyerEmail) || i.buyer.email,
      };
      if (i.buyer.taxCode) i.warnings = i.warnings.filter((w) => w !== "BUYER_PROFILE_INCOMPLETE");
      return touch(i);
    }),
  );
  registerMockRoute(
    "POST",
    "/einvoices/:id/buyer-refresh",
    versioned(P.update, (i) =>
      i.status === "DRAFT" ? touch(i) : fail(409, "EINVOICE_NOT_DRAFT", "Only a draft"),
    ),
  );
  registerMockRoute(
    "POST",
    "/einvoices/:id/void",
    versioned(P.update, (i, body) => {
      if (i.status !== "DRAFT") return transition();
      if (!text(body.reason))
        return fail(400, "VALIDATION_FAILED", "reason", [{ field: "reason", message: "required" }]);
      Object.assign(i, {
        status: "VOIDED_DRAFT",
        voidReason: text(body.reason),
        voidedAt: nowIso(),
      });
      return touch(i);
    }),
  );
  registerMockRoute(
    "POST",
    "/einvoices/:id/reopening",
    versioned(P.update, (i) => {
      if (i.status !== "REJECTED") return transition();
      Object.assign(i, { status: "DRAFT", rejectionCode: null, rejectionMessage: null });
      return touch(i);
    }),
  );
  registerMockRoute(
    "POST",
    "/einvoices/:id/issuance",
    versioned(P.approve, (i) => {
      if (i.status !== "DRAFT") return transition();
      // docs 21 BR-06: bên mua đủ tên, mã số thuế, địa chỉ
      if (!i.buyer.name || !i.buyer.taxCode || !i.buyer.address)
        return fail(409, "EINVOICE_BUYER_PROFILE_INCOMPLETE", "Buyer profile incomplete");
      if (i.correctionBasis === "ERROR" && !i.agreement)
        return fail(409, "EINVOICE_AGREEMENT_REQUIRED", "Agreement required");
      Object.assign(i, { status: "SUBMITTING", submittedAt: nowIso() });
      return touch(i);
    }),
  );
  registerMockRoute(
    "POST",
    "/einvoices/:id/resubmission",
    versioned(P.approve, (i) => {
      if (i.status !== "SUBMITTING" || !i.warnings.includes("UNKNOWN_TO_PROVIDER"))
        return fail(409, "EINVOICE_RESUBMISSION_REFUSED", "Refused");
      i.warnings = i.warnings.filter((w) => w !== "UNKNOWN_TO_PROVIDER");
      i.submittedAt = nowIso();
      return touch(i);
    }),
  );
  registerMockRoute(
    "POST",
    "/einvoices/:id/reconciliation",
    versioned(P.approve, (i) => {
      settle(i, true);
      return ok(detail(i));
    }),
  );
  registerMockRoute(
    "POST",
    "/einvoices/:id/adjustments",
    versioned(P.create, (i, body) => {
      if (i.status !== "ISSUED") return fail(409, "EINVOICE_NOT_IN_FORCE", "Not in force");
      if (
        mockEInvoices().some(
          (o) =>
            o.originalEInvoiceId === i.id &&
            o.type === "REPLACEMENT" &&
            o.status !== "VOIDED_DRAFT",
        )
      )
        return fail(409, "EINVOICE_CORRECTION_FORM_FIXED", "Being replaced");
      const lines = Array.isArray(body.lines) ? (body.lines as Record<string, unknown>[]) : [];
      const adjustment: MockEInvoice = {
        ...i,
        id: nextEInvoiceId(),
        type: "ADJUSTMENT",
        status: "DRAFT",
        adjusted: false,
        originalEInvoiceId: i.id,
        invoiceNumber: null,
        symbol: null,
        issuedAt: null,
        submittedAt: null,
        version: 0,
        warnings: [],
        correctionBasis: (text(body.basis) || "ERROR") as MockEInvoice["correctionBasis"],
        correctionReason: text(body.reason),
        agreement: null,
        returnRequestId: text(body.returnRequestId) || null,
        issueDate: nowIso().slice(0, 10),
        lines: lines.flatMap((l) => {
          const base = i.lines.find((line) => line.id === l.originalLineId);
          return base ? [{ ...base, quantity: Number(l.quantity ?? 0) }] : [];
        }),
      };
      adjustment.code = `HDDT-${adjustment.id.replace("EINV-", "")}`;
      mockEInvoices().push(adjustment);
      return ok(detail(adjustment));
    }),
  );
  registerMockRoute(
    "POST",
    "/einvoices/:id/replacements",
    versioned(P.create, (i, body) => {
      if (i.status !== "ISSUED") return fail(409, "EINVOICE_NOT_IN_FORCE", "Not in force");
      // docs 21 BR-08: hoá đơn đã điều chỉnh không thay thế được
      if (i.adjusted) return fail(409, "EINVOICE_CORRECTION_FORM_FIXED", "Adjusted");
      const replacement: MockEInvoice = {
        ...i,
        id: nextEInvoiceId(),
        type: "REPLACEMENT",
        status: "DRAFT",
        originalEInvoiceId: i.id,
        invoiceNumber: null,
        symbol: null,
        issuedAt: null,
        submittedAt: null,
        version: 0,
        correctionBasis: "ERROR",
        correctionReason: text(body.reason),
        agreement: null,
      };
      replacement.code = `HDDT-${replacement.id.replace("EINV-", "")}`;
      mockEInvoices().push(replacement);
      return ok(detail(replacement));
    }),
  );
  registerMockRoute(
    "PUT",
    "/einvoices/:id/agreement",
    versioned(P.update, (i, body) => {
      const form = body instanceof FormData ? body : null;
      i.agreement = {
        number: String(form?.get("number") ?? "TT"),
        date: String(form?.get("date") ?? nowIso().slice(0, 10)),
      };
      return touch(i);
    }),
  );
  registerMockRoute("GET", "/einvoices/:id/agreement", async (config) => {
    const invoice = byId(pathParams(config).id ?? "");
    return invoice?.agreement
      ? ok({ url: `https://files.example/${invoice.code}-agreement.pdf`, expiresAt: nowIso() })
      : notFound();
  });
  registerMockRoute("GET", "/einvoices/:id/error-notices", async (config) =>
    ok(
      mockErrorNotices()
        .filter((n) => n.einvoiceId === pathParams(config).id)
        .map(noticeWire),
    ),
  );
  registerMockRoute("POST", "/einvoices/:id/error-notices", async (config) => {
    if (!(await can(P.approve))) return forbidden();
    const invoice = byId(pathParams(config).id ?? "");
    if (!invoice) return notFound();
    if (
      mockErrorNotices().some(
        (n) => n.einvoiceId === invoice.id && (n.status === "DRAFT" || n.status === "SENT"),
      )
    )
      return fail(409, "EINVOICE_ERROR_NOTICE_NOT_SENDABLE", "Another notice is open");
    const body = bodyOf(config);
    const notice = {
      id: nextNoticeId(),
      einvoiceId: invoice.id,
      reason: text(body.reason),
      correctBuyerName: text(body.correctBuyerName) || null,
      correctBuyerAddress: text(body.correctBuyerAddress) || null,
      status: "SENT" as const,
      recordedAt: nowIso(),
      sentAt: nowIso(),
    };
    mockErrorNotices().push(notice);
    return ok(noticeWire(notice));
  });
  registerMockRoute("POST", "/einvoices/:id/error-notices/:noticeId/sending", async (config) => {
    const notice = mockErrorNotices().find((n) => n.id === pathParams(config).noticeId);
    if (!notice) return fail(404, "EINVOICE_ERROR_NOTICE_NOT_FOUND", "Not found");
    if (notice.status === "ACCEPTED" || notice.status === "REJECTED")
      return fail(409, "EINVOICE_ERROR_NOTICE_NOT_SENDABLE", "Answered");
    notice.status = "ACCEPTED";
    return ok(noticeWire(notice));
  });
  registerSettingsRoutes();
}

const noticeWire = (n: ReturnType<typeof mockErrorNotices>[number]) => ({
  ...n,
  formCode: "04/SS-HDDT",
  formName: "Thông báo hoá đơn điện tử có sai sót",
  subject: "BUYER_NAME_ADDRESS",
  recordedBy: "USER-ACC-01",
});

function registerSettingsRoutes() {
  const S = EINVOICE_SETTINGS_PERMISSIONS;
  const wire = () => ({ ...mockEInvoiceSettings(), endpoint: "https://sandbox.example/einvoice" });
  const provider = () => {
    const s = mockEInvoiceSettings();
    return {
      provider: s.provider,
      environment: s.environment,
      username: s.username,
      secretSet: s.secretSet,
      active: true,
      autoIssue: s.autoIssue,
      version: s.version,
    };
  };
  const bump = (patch: Partial<ReturnType<typeof mockEInvoiceSettings>>) =>
    setMockEInvoiceSettings({
      ...mockEInvoiceSettings(),
      ...patch,
      version: mockEInvoiceSettings().version + 1,
    });
  registerMockRoute("GET", "/einvoice-settings", async () =>
    (await can(S.read)) ? ok(wire()) : forbidden(),
  );
  registerMockRoute("PUT", "/einvoice-settings", async (config) => {
    if (!(await can(S.update))) return forbidden();
    const body = bodyOf(config);
    if (Number(body.version) !== mockEInvoiceSettings().version) return optimisticLock();
    bump({ autoIssue: body.autoIssue === true });
    return ok(wire());
  });
  registerMockRoute("GET", "/einvoice-settings/providers", async () =>
    (await can(S.read)) ? ok([provider()]) : forbidden(),
  );
  registerMockRoute("PUT", "/einvoice-settings/providers/:provider/account", async (config) => {
    if (!(await can(S.update))) return forbidden();
    const body = bodyOf(config);
    bump({
      environment: body.environment === "PRODUCTION" ? "PRODUCTION" : "SANDBOX",
      username: text(body.username),
      secretSet: mockEInvoiceSettings().secretSet || !!text(body.secret),
    });
    return ok(provider());
  });
  registerMockRoute("PUT", "/einvoice-settings/providers/:provider/series", async (config) => {
    if (!(await can(S.update))) return forbidden();
    const body = bodyOf(config);
    const series = { templateCode: "1", symbol: text(body.symbol), year: Number(body.year) };
    bump({
      series: [series, ...mockEInvoiceSettings().series.filter((s) => s.year !== series.year)],
    });
    return ok(null);
  });
  registerMockRoute("POST", "/einvoice-settings/providers/:provider/activation", async () =>
    (await can(S.update)) ? ok(provider()) : forbidden(),
  );
}
