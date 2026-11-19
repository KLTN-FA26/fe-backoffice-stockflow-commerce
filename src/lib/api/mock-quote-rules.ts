/**
 * Luật báo giá theo thùng của BE (`Quote`, `QuoteLine`, `QuoteFee`, `QuoteService` — origin/develop) cho mock: kiểm body
 * (bean validation của `QuoteRequests`), dựng phần chào giá (`QuoteService.offer`: SKU riêng của khách, bậc giá lấy từ giá
 * riêng khi bỏ trống, phí khuôn tự thêm cho SKU sản xuất lần đầu, VAT theo ngày), rồi các bước vòng đời. Thông báo lấy
 * nguyên văn `messages_vi.properties` (`refusal.quote.*`). Mỗi hàm kiểm hết rồi mới đổi báo giá.
 */

import { QUOTE_FEE_KINDS } from "@/constants";

import { findCustomerPrice } from "./mock-customer-price-store";
import { findMockCustomer } from "./mock-customer-store";
import { placeQuotedOrder } from "./mock-contract-orders";
import { viDateTime, viNumber, wholeNumber } from "./mock-quote-money";
import { NOT_FOUND_MESSAGE, VALIDATION_MESSAGE, refuse, refuseInvalid } from "./mock-quote-refusal";
import { WF02_DEMO_CUSTOMER_ID, WF02_USERS, taxRateOn, vnDay, wf02Sku } from "./mock-quote-seed";
import {
  cartonsOfSku,
  findMockQuote,
  mockQuotes,
  moqOf,
  nextQuoteNumber,
  priceFor,
  statusAt,
} from "./mock-quote-store";
import { isUuidText, text } from "./mock-route-utils";

import type { QuoteApiStatus, QuoteFeeKind } from "@/constants";
import type { MockFieldError } from "./mock-quote-refusal";
import type { MockQuote, MockQuoteFee, MockQuoteLine, MockQuoteTier } from "./mock-quote-store";

/** BE `QuoteLine.MAX_UNITS`. */
const MAX_UNITS = 10_000_000;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** BE `QuoteStatus.canTransitionTo`. */
const TRANSITIONS: Readonly<Record<QuoteApiStatus, readonly QuoteApiStatus[]>> = {
  DRAFT: ["SENT", "CANCELLED"],
  SENT: ["ACCEPTED", "CHANGES_REQUESTED", "EXPIRED"],
  CHANGES_REQUESTED: ["DRAFT"],
  ACCEPTED: ["CONVERTED", "CANCELLED"],
  EXPIRED: [],
  CANCELLED: [],
  CONVERTED: [],
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
const isKind = (value: unknown): value is QuoteFeeKind =>
  (QUOTE_FEE_KINDS as readonly unknown[]).includes(value);
function conflict(code: string, message: string, details?: Record<string, unknown>): never {
  return refuse(409, code, message, [], details);
}

/* ── Body (bean validation của `QuoteRequests`) ──────────────────────── */

interface DraftLine {
  sku: string;
  cartons: number;
  tiers: MockQuoteTier[] | null;
}
interface DraftFee {
  kind: QuoteFeeKind | null;
  sku: string | null;
  amount: number | null;
}
interface Draft {
  validUntil: string;
  terms: string | null;
  requestedDeliveryDate: string | null;
  lines: DraftLine[];
  fees: DraftFee[];
}

function readLines(raw: unknown, errors: MockFieldError[]): DraftLine[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 50) {
    errors.push({ field: "lines", message: "Báo giá có từ 1 đến 50 dòng.", code: "Size" });
    return [];
  }
  return raw.map((item, i) => {
    const line = asRecord(item);
    const sku = text(line.sku);
    if (!sku) errors.push({ field: `lines[${i}].sku`, message: "Cần SKU.", code: "NotBlank" });
    const cartons = wholeNumber(line.cartons, 1);
    if (cartons === null)
      errors.push({ field: `lines[${i}].cartons`, message: "Ít nhất 1 thùng.", code: "Min" });
    let tiers: MockQuoteTier[] | null = null;
    if (Array.isArray(line.tiers) && line.tiers.length > 0) {
      if (line.tiers.length > 20)
        errors.push({ field: `lines[${i}].tiers`, message: "Tối đa 20 bậc giá.", code: "Size" });
      tiers = line.tiers.map((t, j) => {
        const tier = asRecord(t);
        const minQuantity = wholeNumber(tier.minQuantity, 1);
        const unitPrice = wholeNumber(tier.unitPrice, 1);
        if (minQuantity === null)
          errors.push({
            field: `lines[${i}].tiers[${j}].minQuantity`,
            message: "Bậc giá bắt đầu từ 1 thùng trở lên.",
            code: "Min",
          });
        if (unitPrice === null)
          errors.push({
            field: `lines[${i}].tiers[${j}].unitPrice`,
            message: "Đơn giá là số tiền VND nguyên, lớn hơn 0.",
            code: "DecimalMin",
          });
        return { minQuantity: minQuantity ?? 0, unitPrice: unitPrice ?? 0 };
      });
    }
    return { sku: sku.toUpperCase(), cartons: cartons ?? 0, tiers };
  });
}

function readFees(raw: unknown, errors: MockFieldError[]): DraftFee[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.length > 51) {
    errors.push({ field: "fees", message: "Tối đa 51 dòng phí.", code: "Size" });
    return [];
  }
  return raw.map((item, i) => {
    const fee = asRecord(item);
    let amount: number | null = null;
    if (fee.amount !== undefined && fee.amount !== null) {
      amount = wholeNumber(fee.amount, 0);
      if (amount === null)
        errors.push({
          field: `fees[${i}].amount`,
          message: "Số tiền VND nguyên, từ 0 trở lên.",
          code: "Digits",
        });
    }
    return {
      kind: isKind(fee.kind) ? fee.kind : null,
      sku: text(fee.sku).toUpperCase() || null,
      amount,
    };
  });
}

function readDraft(body: Record<string, unknown>, errors: MockFieldError[]): Draft {
  const validUntil = text(body.validUntil);
  if (!validUntil || Number.isNaN(Date.parse(validUntil)))
    errors.push({ field: "validUntil", message: "Cần hạn hiệu lực.", code: "NotNull" });
  const terms = text(body.terms);
  if (terms.length > 2000)
    errors.push({ field: "terms", message: "Điều khoản dài tối đa 2000 ký tự.", code: "Size" });
  const day = text(body.requestedDeliveryDate);
  if (day && !DAY.test(day))
    errors.push({ field: "requestedDeliveryDate", message: "Ngày không hợp lệ.", code: "Pattern" });
  return {
    validUntil: validUntil ? new Date(validUntil).toISOString() : "",
    terms: terms || null,
    requestedDeliveryDate: day || null,
    lines: readLines(body.lines, errors),
    fees: readFees(body.fees, errors),
  };
}

function readVersion(body: Record<string, unknown>, errors: MockFieldError[]): number {
  const version = wholeNumber(body.version, 0);
  if (version === null) errors.push({ field: "version", message: "Cần version.", code: "NotNull" });
  return version ?? -1;
}

function requireNoErrors(errors: MockFieldError[]): void {
  if (errors.length > 0) refuseInvalid(VALIDATION_MESSAGE, errors);
}

/* ── Khách, SKU, giá (QuoteService) ──────────────────────────────────── */

/** BE `requireNewWorkFor`: khách phải tồn tại và đang hoạt động. */
function requireNewWorkFor(customerId: string): void {
  const customer = findMockCustomer(customerId);
  if (!customer) refuse(404, "CUSTOMER_NOT_FOUND", "Không tìm thấy khách hàng");
  if (customer.status !== "ACTIVE")
    conflict(
      "CUSTOMER_NOT_ACTIVE",
      `Khách hàng đang ở trạng thái ${customer.status}: chỉ khách đang hoạt động mới nhận được báo giá.`,
    );
}

/** 14 BR-04: SKU của khách khác → 404 như không tồn tại; SKU không phải của khách → CUSTOMER_SKU_REQUIRED. */
function requireOwnSkus(customerId: string, skus: readonly string[]): void {
  const id = customerId.toLowerCase();
  if (skus.some((sku) => (wf02Sku(sku)?.ownerCustomerId ?? id) !== id))
    refuse(404, "VARIANT_NOT_FOUND", "Không tìm thấy biến thể");
  const foreign = skus.filter((sku) => !wf02Sku(sku));
  if (foreign.length === 0) return;
  refuse(
    409,
    "CUSTOMER_SKU_REQUIRED",
    `Dòng báo giá chỉ là SKU riêng của chính khách hàng, không phải ${foreign.join(", ")}.`,
    skus.flatMap((sku, i) =>
      wf02Sku(sku)
        ? []
        : [
            {
              field: `lines[${i}].sku`,
              message: `${sku} không phải SKU riêng của khách hàng này.`,
              code: "CUSTOMER_SKU_REQUIRED",
            },
          ],
    ),
  );
}

/** 13 BR-05: dòng bỏ trống bậc giá lấy giá riêng của khách, đọc ở số thùng của dòng. */
function defaultTiers(customerId: string, sku: string, cartons: number): MockQuoteTier[] {
  const price = findCustomerPrice(customerId, sku);
  if (!price || price.tiers.length === 0)
    refuseInvalid(`Khách chưa có bảng giá riêng cho ${sku}: nhập bậc giá cho dòng này.`);
  const tiers = price.tiers.map((t) => ({
    minQuantity: t.minQuantity,
    unitPrice: Number(t.unitPrice),
  }));
  const moq = tiers[0]?.minQuantity ?? 0;
  if (cartons < moq)
    refuseInvalid(
      `${cartons} thùng ${sku} thấp hơn mức tối thiểu ${moq} thùng của bảng giá khách: nhập bậc giá đã thoả thuận.`,
    );
  return tiers;
}

/** BE `QuoteLine.belowMoq` (F-03.1): thông báo có MOQ + `details` để FE tô dòng. */
function belowMoq(lineNo: number, sku: string, cartons: number, moq: number): never {
  return conflict(
    "QUOTE_BELOW_MOQ",
    `Dòng ${lineNo} (${sku}): ${cartons} thùng thấp hơn số lượng đặt tối thiểu (MOQ) là ${moq} thùng.`,
    { lineNo, sku, cartons, moq },
  );
}

/** BE `QuoteService.fees` (14 BR-17, BR-20): phí khuôn tự thêm cho SKU sản xuất lần đầu; tối đa một phí vận chuyển. */
function buildFees(given: readonly DraftFee[], skus: readonly string[], day: string) {
  const errors: MockFieldError[] = [];
  const plates = new Map<string, number | null>();
  let shipping: number | null = null;
  given.forEach((fee, i) => {
    const field = `fees[${i}]`;
    if (fee.kind === null) {
      errors.push({
        field: `${field}.kind`,
        message: "Dòng phí phải là phí khuôn / bản in hoặc phí vận chuyển.",
        code: "NotNull",
      });
    } else if (fee.kind === "SHIPPING_FEE") {
      if (shipping !== null || fee.amount === null)
        errors.push({
          field,
          message: "Chỉ có tối đa một dòng phí vận chuyển, kèm số tiền.",
          code: "SHIPPING_FEE",
        });
      else shipping = fee.amount;
    } else if (fee.sku === null || !skus.includes(fee.sku)) {
      errors.push({
        field: `${field}.sku`,
        message: "Phí khuôn / bản in phải dành cho một SKU có trên báo giá.",
        code: "PLATE_FEE",
      });
    } else if (wf02Sku(fee.sku)?.producedBefore) {
      errors.push({
        field: `${field}.sku`,
        message: `${fee.sku} đã từng sản xuất: đặt lại không có phí khuôn / bản in.`,
        code: "PLATE_FEE",
      });
    } else if (plates.has(fee.sku)) {
      errors.push({
        field: `${field}.sku`,
        message: `SKU ${fee.sku} chỉ có tối đa một dòng phí khuôn / bản in.`,
        code: "PLATE_FEE",
      });
    } else {
      plates.set(fee.sku, fee.amount);
    }
  });
  if (errors.length > 0) refuseInvalid("Các dòng phí chưa hợp lệ.", errors);
  if (shipping === 0) refuseInvalid("Phí vận chuyển là số tiền VND nguyên, lớn hơn 0.");
  const fees: MockQuoteFee[] = [...new Set(skus)]
    .filter((sku) => !wf02Sku(sku)?.producedBefore)
    .map((sku) => {
      const taxClass = wf02Sku(sku)?.taxClass ?? null;
      return {
        id: crypto.randomUUID(),
        kind: "PLATE_FEE",
        sku,
        amount: plates.get(sku) ?? null,
        taxClass,
        taxRate: taxClass === null ? null : taxRateOn(taxClass, day),
      };
    });
  if (shipping !== null)
    fees.push({
      id: crypto.randomUUID(),
      kind: "SHIPPING_FEE",
      sku: null,
      amount: shipping,
      taxClass: "STANDARD",
      taxRate: taxRateOn("STANDARD", day),
    });
  return fees;
}

interface Offer {
  validUntil: string;
  terms: string | null;
  requestedDeliveryDate: string | null;
  lines: MockQuoteLine[];
  fees: MockQuoteFee[];
}

/** BE `QuoteService.offer` + `Quote.Offer`: dòng mới (id mới) mỗi lần lập / sửa; nháp chưa có gì được chấp nhận. */
function buildOffer(customerId: string, draft: Draft): Offer {
  if (Date.parse(draft.validUntil) <= Date.now())
    refuseInvalid("Hạn hiệu lực của báo giá phải ở tương lai.");
  const skus = draft.lines.map((line) => line.sku);
  requireOwnSkus(customerId, skus);
  const today = vnDay();
  const lines = draft.lines.map((line, i): MockQuoteLine => {
    const seedSku = wf02Sku(line.sku);
    const unitsPerCarton = seedSku?.unitsPerCarton ?? 0;
    const lineNo = i + 1;
    const tiers = line.tiers
      ? [...line.tiers].sort((a, b) => a.minQuantity - b.minQuantity)
      : defaultTiers(customerId, line.sku, cartonsOfSku(draft.lines, line.sku));
    if (line.cartons * unitsPerCarton > MAX_UNITS)
      refuseInvalid(
        `Dòng ${lineNo}: ${viNumber(line.cartons)} thùng vượt giới hạn (tối đa ${viNumber(MAX_UNITS)} cái).`,
      );
    const twice = tiers.find((t, j) => j > 0 && tiers[j - 1]?.minQuantity === t.minQuantity);
    if (twice)
      refuseInvalid(`Dòng ${lineNo} có hai bậc giá cùng bắt đầu từ ${twice.minQuantity} thùng.`);
    const taxClass = seedSku?.taxClass ?? null;
    return {
      id: crypto.randomUUID(),
      lineNo,
      sku: line.sku,
      cartons: line.cartons,
      unitsPerCarton,
      tiers,
      taxClass,
      taxRate: taxClass === null ? null : taxRateOn(taxClass, today),
      acceptedCartons: null,
      acceptedUnitPrice: null,
    };
  });
  const fees = buildFees(draft.fees, skus, today);
  if (draft.requestedDeliveryDate && draft.requestedDeliveryDate < today)
    refuseInvalid("Ngày giao khách yêu cầu không được ở quá khứ.");
  const twice = skus.find((sku, i) => skus.indexOf(sku) !== i);
  if (twice) refuseInvalid(`SKU ${twice} xuất hiện hai lần trong báo giá: mỗi SKU chỉ một dòng.`);
  for (const line of lines) {
    const moq = moqOf(line);
    const cartons = cartonsOfSku(lines, line.sku);
    if (moq !== null && cartons < moq) belowMoq(line.lineNo, line.sku, cartons, moq);
  }
  return { ...draft, lines, fees };
}

/* ── Vòng đời ────────────────────────────────────────────────────────── */

function record(
  quote: MockQuote,
  from: QuoteApiStatus | null,
  to: QuoteApiStatus,
  reason: string | null,
  by: string,
): void {
  quote.history.push({
    revision: quote.revision,
    fromStatus: from,
    toStatus: to,
    reason,
    changedAt: new Date().toISOString(),
    changedBy: by,
  });
}

function transitionRefused(quote: MockQuote, verb: string): never {
  return conflict(
    "INVALID_QUOTE_TRANSITION",
    `Báo giá ${quote.quoteNumber} đang ở trạng thái ${quote.status}: không thể ${verb} lúc này.`,
  );
}

function find(id: string): MockQuote {
  const quote = findMockQuote(id);
  if (!quote) refuse(404, "NOT_FOUND", NOT_FOUND_MESSAGE);
  return quote;
}

function requireVersion(quote: MockQuote, version: number): void {
  if (quote.version !== version)
    conflict(
      "OPTIMISTIC_LOCK",
      `Báo giá ${quote.quoteNumber} vừa được người khác thay đổi: tải lại rồi thử lại.`,
    );
}

/** `POST /quotes` — idempotent theo `requestId` (cùng khách → trả lại báo giá đã lập). */
export function createQuote(body: Record<string, unknown>): MockQuote {
  const errors: MockFieldError[] = [];
  const requestId = text(body.requestId);
  const customerId = text(body.customerId).toLowerCase();
  if (!isUuidText(requestId))
    errors.push({ field: "requestId", message: "Cần requestId.", code: "NotNull" });
  if (!isUuidText(customerId))
    errors.push({ field: "customerId", message: "Cần customerId.", code: "NotNull" });
  const draft = readDraft(body, errors);
  requireNoErrors(errors);
  const earlier = mockQuotes().find((q) => q.requestId === requestId);
  if (earlier) {
    if (earlier.customerId !== customerId)
      refuse(422, "IDEMPOTENCY_KEY_REUSED", "Mã yêu cầu này đã được dùng cho một yêu cầu khác");
    return earlier;
  }
  requireNewWorkFor(customerId);
  const offer = buildOffer(customerId, draft);
  const now = new Date().toISOString();
  const quote: MockQuote = {
    id: crypto.randomUUID(),
    quoteNumber: nextQuoteNumber(),
    requestId,
    customerId,
    status: "DRAFT",
    revision: 1,
    ...offer,
    sentAt: null,
    sentBy: null,
    respondedAt: null,
    respondedBy: null,
    customerFeedback: null,
    cancellationReason: null,
    convertedOrderId: null,
    convertedAt: null,
    history: [],
    createdAt: now,
    createdBy: WF02_USERS.sales,
    version: 0,
  };
  record(quote, null, "DRAFT", null, WF02_USERS.sales);
  mockQuotes().push(quote);
  return quote;
}

/** `PUT /quotes/{id}` — chỉ nháp; thay toàn bộ dòng và phí. */
export function editQuote(id: string, body: Record<string, unknown>): MockQuote {
  const errors: MockFieldError[] = [];
  const version = readVersion(body, errors);
  const draft = readDraft(body, errors);
  requireNoErrors(errors);
  const quote = find(id);
  requireVersion(quote, version);
  const offer = buildOffer(quote.customerId, draft);
  if (quote.status !== "DRAFT") transitionRefused(quote, "sửa");
  Object.assign(quote, offer);
  quote.version += 1;
  return quote;
}

/** `POST /quotes/{id}/sending` — DRAFT → SENT (14 §4.1 bước 3). */
export function sendQuote(id: string, body: Record<string, unknown>): MockQuote {
  const errors: MockFieldError[] = [];
  const version = readVersion(body, errors);
  requireNoErrors(errors);
  const quote = find(id);
  requireVersion(quote, version);
  requireOwnSkus(
    quote.customerId,
    quote.lines.map((line) => line.sku),
  );
  requireNewWorkFor(quote.customerId);
  // 14 BR-17: SKU còn sản xuất lần đầu phải có dòng phí khuôn
  const missing = [...new Set(quote.lines.map((line) => line.sku))]
    .filter(
      (sku) =>
        !wf02Sku(sku)?.producedBefore &&
        !quote.fees.some((fee) => fee.kind === "PLATE_FEE" && fee.sku === sku),
    )
    .sort();
  if (missing.length > 0)
    conflict(
      "QUOTE_PLATE_FEE_MISSING",
      `Báo giá ${quote.quoteNumber}: ${missing.join(", ")} sản xuất lần đầu nhưng chưa có dòng phí khuôn / bản in: sửa báo giá để thêm.`,
    );
  if (quote.status !== "DRAFT") transitionRefused(quote, "gửi");
  const unpriced = quote.lines.find((line) => line.tiers.length === 0);
  if (unpriced)
    conflict(
      "QUOTE_NOT_PRICED",
      `Báo giá ${quote.quoteNumber}, dòng ${unpriced.lineNo} chưa có giá: nhập bậc giá trước khi gửi.`,
    );
  const unpricedFee = quote.fees.find((fee) => fee.amount === null);
  if (unpricedFee)
    conflict(
      "QUOTE_NOT_PRICED",
      `Báo giá ${quote.quoteNumber}: ${unpricedFee.kind} của ${unpricedFee.sku ?? ""} chưa có số tiền: nhập số tiền trước khi gửi.`,
    );
  const untaxed = quote.lines.find((line) => line.taxRate === null);
  if (untaxed)
    conflict(
      "QUOTE_TAX_CLASS_MISSING",
      `Báo giá ${quote.quoteNumber}, dòng ${untaxed.lineNo}: sản phẩm của ${untaxed.sku} chưa có nhóm thuế; khai báo nhóm thuế trước khi gửi.`,
    );
  if (Date.parse(quote.validUntil) <= Date.now())
    refuseInvalid(
      `Báo giá ${quote.quoteNumber} có hiệu lực đến ${viDateTime(quote.validUntil)}, đã qua: đặt hạn hiệu lực mới trước khi gửi.`,
    );
  quote.status = "SENT";
  quote.sentAt = new Date().toISOString();
  quote.sentBy = WF02_USERS.sales;
  record(quote, "DRAFT", "SENT", null, WF02_USERS.sales);
  quote.version += 1;
  return quote;
}

/** BE `lockToAnswer` + `requireAnswerable`: khách trả lời báo giá đã gửi, còn hiệu lực, đúng version. */
function lockToAnswer(id: string, version: number, target: QuoteApiStatus): MockQuote {
  const quote = find(id);
  if (quote.status === "CANCELLED" && quote.sentAt !== null)
    conflict(
      "INVALID_QUOTE_TRANSITION",
      `Báo giá ${quote.quoteNumber} đã bị huỷ: ${quote.cancellationReason ?? ""}`,
    );
  requireVersion(quote, version);
  requireNewWorkFor(quote.customerId);
  if (statusAt(quote) === "EXPIRED")
    conflict(
      "QUOTE_EXPIRED",
      `Báo giá ${quote.quoteNumber} chỉ có hiệu lực đến ${viDateTime(quote.validUntil)} và đã hết hiệu lực.`,
    );
  if (!TRANSITIONS[quote.status].includes(target)) transitionRefused(quote, "trả lời");
  return quote;
}

const customerUserOf = (quote: MockQuote) =>
  quote.customerId === WF02_DEMO_CUSTOMER_ID ? WF02_USERS.demoCustomer : WF02_USERS.tsmCustomer;

/**
 * `POST /quotes/{id}/acceptance` — route của KHÁCH (storefront): SENT → ACCEPTED, mỗi dòng ở số thùng khách chọn (bỏ
 * trống = số đề xuất), đơn giá theo bậc của tổng thùng SKU (14 BR-07). Mock back-office không kiểm vai khách.
 */
export function acceptQuote(id: string, body: Record<string, unknown>): MockQuote {
  const errors: MockFieldError[] = [];
  const version = readVersion(body, errors);
  const asked = new Map<string, number>();
  const raw = body.lines;
  if (Array.isArray(raw))
    raw.forEach((item, i) => {
      const line = asRecord(item);
      const cartons = wholeNumber(line.cartons, 1);
      if (!isUuidText(text(line.lineId)))
        errors.push({ field: `lines[${i}].lineId`, message: "Cần lineId.", code: "NotNull" });
      if (cartons === null)
        errors.push({ field: `lines[${i}].cartons`, message: "Ít nhất 1 thùng.", code: "Min" });
      asked.set(text(line.lineId), cartons ?? 0);
    });
  requireNoErrors(errors);
  const quote = lockToAnswer(id, version, "ACCEPTED");
  if ([...asked.keys()].some((lineId) => !quote.lines.some((line) => line.id === lineId)))
    refuseInvalid(`Có dòng không thuộc báo giá ${quote.quoteNumber}.`);
  const chosen = quote.lines.map((line) => ({
    ...line,
    cartons: asked.get(line.id) ?? line.cartons,
  }));
  const prices = chosen.map((line) => {
    const cartons = cartonsOfSku(chosen, line.sku);
    const moq = moqOf(line);
    if (moq === null) conflict("QUOTE_NOT_PRICED", `Dòng ${line.lineNo} chưa có giá.`);
    if (cartons < moq) belowMoq(line.lineNo, line.sku, cartons, moq);
    return priceFor(line, cartons);
  });
  quote.lines.forEach((line, i) => {
    line.acceptedCartons = chosen[i]?.cartons ?? line.cartons;
    line.acceptedUnitPrice = prices[i] ?? null;
  });
  quote.status = "ACCEPTED";
  quote.respondedAt = new Date().toISOString();
  quote.respondedBy = customerUserOf(quote);
  record(quote, "SENT", "ACCEPTED", null, quote.respondedBy);
  quote.version += 1;
  return quote;
}

/** `POST /quotes/{id}/change-request` — route của KHÁCH: SENT → CHANGES_REQUESTED kèm điều cần sửa. */
export function requestQuoteChanges(id: string, body: Record<string, unknown>): MockQuote {
  const errors: MockFieldError[] = [];
  const version = readVersion(body, errors);
  const feedback = text(body.feedback);
  if (!feedback || feedback.length > 2000)
    errors.push({ field: "feedback", message: "Cần nội dung (tối đa 2000 ký tự).", code: "Size" });
  requireNoErrors(errors);
  const quote = lockToAnswer(id, version, "CHANGES_REQUESTED");
  quote.status = "CHANGES_REQUESTED";
  quote.respondedAt = new Date().toISOString();
  quote.respondedBy = customerUserOf(quote);
  quote.customerFeedback = feedback;
  record(quote, "SENT", "CHANGES_REQUESTED", feedback, quote.respondedBy);
  quote.version += 1;
  return quote;
}

/** `POST /quotes/{id}/revision` — CHANGES_REQUESTED → DRAFT, bản sửa + 1, xoá phần khách đã trả lời. */
export function reviseQuote(id: string, body: Record<string, unknown>): MockQuote {
  const errors: MockFieldError[] = [];
  const version = readVersion(body, errors);
  requireNoErrors(errors);
  const quote = find(id);
  requireVersion(quote, version);
  if (quote.status !== "CHANGES_REQUESTED") transitionRefused(quote, "mở bản sửa mới");
  quote.status = "DRAFT";
  quote.revision += 1;
  quote.respondedAt = null;
  quote.respondedBy = null;
  quote.customerFeedback = null;
  quote.lines.forEach((line) => {
    line.acceptedCartons = null;
    line.acceptedUnitPrice = null;
  });
  record(quote, "CHANGES_REQUESTED", "DRAFT", null, WF02_USERS.sales);
  quote.version += 1;
  return quote;
}

/**
 * `POST /quotes/{id}/cancellation` — nháp, hoặc báo giá đã chấp nhận có SKU ngừng bán (quyết định 2026-10-17). SKU seed
 * đều đang bán, nên báo giá đã chấp nhận luôn bị từ chối như BE.
 */
export function cancelQuote(id: string, body: Record<string, unknown>): MockQuote {
  const errors: MockFieldError[] = [];
  const version = readVersion(body, errors);
  const reason = text(body.reason);
  if (!reason || reason.length > 500)
    errors.push({ field: "reason", message: "Cần lý do (tối đa 500 ký tự).", code: "Size" });
  requireNoErrors(errors);
  const quote = find(id);
  requireVersion(quote, version);
  if (quote.status === "ACCEPTED")
    conflict(
      "INVALID_QUOTE_TRANSITION",
      `Báo giá ${quote.quoteNumber} đã được chấp nhận và mọi SKU vẫn còn bán: hãy tạo đơn từ báo giá thay vì huỷ.`,
    );
  if (!TRANSITIONS[quote.status].includes("CANCELLED")) transitionRefused(quote, "huỷ");
  const from = quote.status;
  quote.status = "CANCELLED";
  quote.cancellationReason = reason;
  record(quote, from, "CANCELLED", reason, WF02_USERS.sales);
  quote.version += 1;
  return quote;
}

/**
 * `POST /quotes/{id}/conversion` — ACCEPTED → CONVERTED + đơn NHÁP ở số thùng và đơn giá khách đã chấp nhận (14 §4.2
 * bước 7). Báo giá đã chuyển: trả lại như cũ, không lập đơn thứ hai (BE trả lời lần gọi lại, không làm lại).
 * Mock bỏ qua `shippingAddressId` / `billingAddressId`: đơn luôn lấy địa chỉ mặc định của khách (seed).
 */
export function convertQuote(id: string, body: Record<string, unknown>): MockQuote {
  const errors: MockFieldError[] = [];
  const version = readVersion(body, errors);
  requireNoErrors(errors);
  const quote = find(id);
  if (quote.status === "CONVERTED") return quote;
  requireVersion(quote, version);
  if (quote.status !== "ACCEPTED")
    conflict(
      "INVALID_QUOTE_TRANSITION",
      `Báo giá ${quote.quoteNumber} đang ở trạng thái ${quote.status}: chỉ báo giá đã được chấp nhận mới tạo được đơn.`,
    );
  requireOwnSkus(
    quote.customerId,
    quote.lines.map((line) => line.sku),
  );
  const order = placeQuotedOrder({
    requestId: `quote-conversion:${quote.id}`,
    customerId: quote.customerId,
    quoteNumber: quote.quoteNumber,
    lines: quote.lines.map((line) => {
      const cartons = line.acceptedCartons ?? line.cartons;
      return {
        sku: line.sku,
        cartons,
        unitsPerCarton: line.unitsPerCarton,
        quantity: cartons * line.unitsPerCarton,
        unitPrice: line.acceptedUnitPrice ?? 0,
        taxRate: line.taxRate,
        requestedDeliveryDate: quote.requestedDeliveryDate,
      };
    }),
    fees: quote.fees.map((fee) => ({
      kind: fee.kind,
      sku: fee.sku,
      amount: fee.amount ?? 0,
      taxRate: fee.taxRate,
    })),
  });
  quote.status = "CONVERTED";
  quote.convertedOrderId = order.orderId;
  quote.convertedAt = new Date().toISOString();
  record(quote, "ACCEPTED", "CONVERTED", order.orderNumber, WF02_USERS.sales);
  quote.version += 1;
  return quote;
}
