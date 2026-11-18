/**
 * Mock route — báo giá theo thùng (WF-02 pha A), đúng hợp đồng BE `QuoteController` (origin/develop; plan WF02-FE Phụ lục
 * A.1): danh sách (trang từ 0, lọc trạng thái / khách / số báo giá), chi tiết, lập (idempotent theo `requestId`, 201),
 * sửa nháp, gửi, mở bản sửa, huỷ, chuyển thành đơn nháp, PDF. Luật ở `mock-quote-rules.ts`, store ở `mock-quote-store.ts`.
 *
 * Hai route của KHÁCH (`/acceptance`, `/change-request`) cũng có — storefront gọi chúng; ở back-office (không có màn
 * khách) đây là cách đưa một báo giá đã gửi sang ACCEPTED khi chạy mock: `api.post('/quotes/{id}/acceptance',
 * { version })` (test làm vậy). Seed không có báo giá nào đang chờ khách.
 */

import { QUOTE_API_STATUSES } from "@/constants";

import { registerMockRoute } from "./mock-adapter";
import {
  acceptQuote,
  cancelQuote,
  convertQuote,
  createQuote,
  editQuote,
  requestQuoteChanges,
  reviseQuote,
  sendQuote,
} from "./mock-quote-rules";
import { MockRefusal, guarded, refuseNotFound } from "./mock-quote-refusal";
import { findMockQuote, mockQuotes, quoteRow, quoteView, statusAt } from "./mock-quote-store";
import {
  bodyOf,
  isUuidText,
  ok,
  pageOf,
  pathParams,
  queryOf,
  typeMismatch,
} from "./mock-route-utils";
import { mockTextPdf } from "./mock-text-pdf";

import type { AxiosRequestConfig } from "axios";
import type { QuoteApiStatus } from "@/constants";
import type { MockQuote } from "./mock-quote-store";

/** BE `Pages.DEFAULT_PAGE_SIZE`. */
const DEFAULT_PAGE_SIZE = 20;
/** BE `QuoteService.SORT`: mặc định `createdAt` giảm dần. */
const SORT_KEYS: Readonly<Record<string, (q: MockQuote) => string>> = {
  createdAt: (q) => q.createdAt,
  validUntil: (q) => q.validUntil,
  quoteNumber: (q) => q.quoteNumber,
  status: (q) => q.status,
};

const isStatus = (value: string): value is QuoteApiStatus =>
  (QUOTE_API_STATUSES as readonly string[]).includes(value);

/** Id báo giá trên đường dẫn — Spring bind `UUID`, sai dạng → 400 UNSUPPORTED_PARAMETER. */
function quoteIdOf(config: AxiosRequestConfig): string {
  const id = pathParams(config).id ?? "";
  if (!isUuidText(id)) throw new MockRefusal(typeMismatch("quoteId", "UUID"));
  return id;
}

function list(config: AxiosRequestConfig) {
  const query = queryOf(config);
  const page = Number(query.get("page") ?? 0);
  const size = Number(query.get("size") ?? DEFAULT_PAGE_SIZE);
  if (!Number.isInteger(page) || page < 0) return typeMismatch("page", "int");
  if (!Number.isInteger(size) || size < 1) return typeMismatch("size", "Integer");
  const statuses = query.getAll("status").flatMap((s) => s.split(","));
  if (statuses.some((s) => !isStatus(s))) return typeMismatch("status", "QuoteStatus");
  const customerId = query.get("customerId");
  if (customerId && !isUuidText(customerId)) return typeMismatch("customerId", "UUID");
  const search = (query.get("search") ?? "").trim().toUpperCase();
  const [field = "", direction = "desc"] = (query.get("sort") ?? "").split(",");
  const known = field in SORT_KEYS;
  const key = SORT_KEYS[known ? field : "createdAt"] ?? ((q: MockQuote) => q.createdAt);
  const sign = known && direction.toLowerCase() === "asc" ? 1 : -1;
  const rows = mockQuotes()
    .filter(
      (q) =>
        (!customerId || q.customerId === customerId.toLowerCase()) &&
        (!search || q.quoteNumber.toUpperCase().includes(search)) &&
        // BE `statusAt`: báo giá đã gửi quá hạn nằm ở EXPIRED, không ở SENT
        (statuses.length === 0 || statuses.includes(statusAt(q))),
    )
    .sort((a, b) => (key(a) < key(b) ? -sign : key(a) > key(b) ? sign : 0))
    .map(quoteRow);
  return ok(pageOf(rows, page, size));
}

function detail(config: AxiosRequestConfig) {
  const quote = findMockQuote(quoteIdOf(config));
  return quote ? ok(quoteView(quote)) : refuseNotFound();
}

/** PDF tối giản (Helvetica không có dấu tiếng Việt — mock chỉ cần mở được). */
function documentOf(config: AxiosRequestConfig) {
  const quote = findMockQuote(quoteIdOf(config));
  if (!quote) return refuseNotFound();
  const view = quoteView(quote);
  return {
    status: 200,
    data: mockTextPdf([
      `Quote ${quote.quoteNumber} - revision ${quote.revision} (mock)`,
      `Valid until ${quote.validUntil}`,
      ...view.lines.map(
        (line) =>
          `${line.lineNo}. ${line.sku}: ${line.cartons} cartons x ${line.unitsPerCarton} = ${line.units} pcs`,
      ),
      `Total with VAT: ${view.proposedTotal ?? "-"} VND`,
    ]),
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${quote.quoteNumber}.pdf"`,
    },
  };
}

const action = (run: (id: string, body: Record<string, unknown>) => MockQuote) =>
  guarded((config) => ok(quoteView(run(quoteIdOf(config), bodyOf(config)))));

export function registerQuoteMockRoutes(): void {
  registerMockRoute("GET", "/quotes", guarded(list));
  registerMockRoute(
    "POST",
    "/quotes",
    guarded((config) => ok(quoteView(createQuote(bodyOf(config))), 201)),
  );
  registerMockRoute("GET", "/quotes/:id", guarded(detail));
  registerMockRoute("PUT", "/quotes/:id", action(editQuote));
  registerMockRoute("GET", "/quotes/:id/document", guarded(documentOf));
  registerMockRoute("POST", "/quotes/:id/sending", action(sendQuote));
  registerMockRoute("POST", "/quotes/:id/acceptance", action(acceptQuote));
  registerMockRoute("POST", "/quotes/:id/change-request", action(requestQuoteChanges));
  registerMockRoute("POST", "/quotes/:id/revision", action(reviseQuote));
  registerMockRoute("POST", "/quotes/:id/cancellation", action(cancelQuote));
  registerMockRoute("POST", "/quotes/:id/conversion", action(convertQuote));
}
