/**
 * Các bước của hợp đồng mua bán (BE `SalesContractService` + `SalesContract`, origin/develop) cho mock: lập (mặc định 1
 * đợt giao + lịch thanh toán mặc định của khách), sửa nháp, gợi ý tiền theo đợt giao, gửi (đơn → PENDING_CONTRACT, cảnh
 * báo tín dụng), ghi nhận đã ký (đơn → ON_HOLD/CREDIT, PENDING_PAYMENT hoặc CONFIRMED; mở đợt thanh toán ở mock thanh
 * toán), huỷ (đơn về DRAFT). Thứ tự kiểm như BE: hình body → đơn → hợp đồng → version → trạng thái → luật lịch.
 */

import { CONTRACT_MILESTONES } from "@/constants";

import {
  contractSignedOf,
  findWf02Order,
  sendContractOf,
  withdrawContractOf,
} from "./mock-contract-orders";
import {
  DEFAULT_FREE_SAMPLE_ROUNDS,
  DEFAULT_RETURN_WINDOW_DAYS,
  creditApproved,
  creditCheckOf,
  creditTermsOf,
  liveContractOf,
  mockContracts,
} from "./mock-contract-store";
import {
  MAX_ROWS,
  defaultSchedule,
  entryOf,
  plan,
  requireWindows,
  schedule,
  suggestTied,
} from "./mock-contract-terms";
import { legalBuyerOf } from "./mock-legal-profile-store";
import { mockInstallments } from "./mock-payment-store";
import { viDay, wholeNumber } from "./mock-quote-money";
import { NOT_FOUND_MESSAGE, VALIDATION_MESSAGE, refuse, refuseInvalid } from "./mock-quote-refusal";
import { WF02_SELLER, WF02_USERS, addDays, vnDay } from "./mock-quote-seed";
import { text } from "./mock-route-utils";
import { backendStatus, findOrder } from "./mock-routes-orders-store";

import type { ContractMilestone } from "@/constants";
import type { Wf02Order } from "./mock-contract-orders";
import type { MockContract } from "./mock-contract-store";
import type { BatchEntry, InstallmentEntry } from "./mock-contract-terms";
import type { MockFieldError } from "./mock-quote-refusal";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
const numberOrNull = (value: unknown): number | null => (typeof value === "number" ? value : null);
const dayOrNull = (value: unknown): string | null => {
  const day = text(value);
  return DAY.test(day) ? day : null;
};
const isMilestone = (value: unknown): value is ContractMilestone =>
  (CONTRACT_MILESTONES as readonly unknown[]).includes(value);

function conflict(code: string, message: string): never {
  return refuse(409, code, message);
}

/* ── Đơn và hợp đồng của đường dẫn ───────────────────────────────────── */

/**
 * Đơn WF-02 của `orderId`. Đơn cũ của mock-data (không đặt theo thùng, không có hợp đồng): đọc là "chưa có hợp đồng",
 * lập thì bị từ chối như BE (`SALES_CONTRACT_ORDER_NOT_DRAFT` / `_NOT_CARTONS`); id lạ → 404 NOT_FOUND.
 */
async function orderOf(orderId: string, creating = false): Promise<Wf02Order> {
  const order = findWf02Order(orderId);
  if (order) return order;
  const legacy = await findOrder(orderId);
  if (!legacy) return refuse(404, "NOT_FOUND", NOT_FOUND_MESSAGE);
  const status = backendStatus(legacy);
  if (!creating)
    return refuse(404, "SALES_CONTRACT_NOT_FOUND", `Đơn ${legacy.orderNumber} chưa có hợp đồng.`);
  if (status !== "DRAFT")
    return conflict(
      "SALES_CONTRACT_ORDER_NOT_DRAFT",
      `Đơn ${legacy.orderNumber} đang ở trạng thái ${status}: chỉ lập, sửa và gửi hợp đồng cho đơn nháp.`,
    );
  return conflict(
    "SALES_CONTRACT_ORDER_NOT_CARTONS",
    `Đơn ${legacy.orderNumber} có dòng không đặt theo thùng: hợp đồng chỉ lập cho đơn đặt theo thùng SKU riêng của khách.`,
  );
}

/** Đơn chỉ đọc được của mock-data → không có hợp đồng nào (lịch sử rỗng). */
export async function contractOrderOrNull(orderId: string): Promise<Wf02Order | null> {
  if (findWf02Order(orderId)) return orderOf(orderId);
  if (await findOrder(orderId)) return null;
  return refuse(404, "NOT_FOUND", NOT_FOUND_MESSAGE);
}

export async function loadContract(orderId: string, version?: number) {
  const order = await orderOf(orderId);
  const contract = liveContractOf(order.orderId);
  if (!contract)
    return refuse(404, "SALES_CONTRACT_NOT_FOUND", `Đơn ${order.orderNumber} chưa có hợp đồng.`);
  if (version !== undefined) requireVersion(contract, version);
  return { order, contract };
}

function requireVersion(contract: MockContract, version: number): void {
  if (contract.version !== version)
    conflict(
      "OPTIMISTIC_LOCK",
      `Hợp đồng ${contract.contractNumber} vừa được người khác thay đổi: tải lại rồi thử lại.`,
    );
}

function requireDraftOrder(order: Wf02Order): void {
  if (order.status !== "DRAFT")
    conflict(
      "SALES_CONTRACT_ORDER_NOT_DRAFT",
      `Đơn ${order.orderNumber} đang ở trạng thái ${order.status}: chỉ lập, sửa và gửi hợp đồng cho đơn nháp.`,
    );
}

/** BE `SalesContract.requireStatus`. */
function requireStatus(contract: MockContract, wanted: MockContract["status"], verb: string) {
  if (contract.status === wanted) return;
  const tail =
    verb === "edited"
      ? "chỉ sửa được hợp đồng nháp. Cần đổi nội dung thì huỷ hợp đồng rồi lập lại."
      : verb === "sent"
        ? "chỉ gửi được hợp đồng nháp."
        : "chỉ ghi nhận ký được cho hợp đồng đã gửi.";
  conflict(
    "SALES_CONTRACT_STATUS_INVALID",
    `Hợp đồng ${contract.contractNumber} đang ở trạng thái ${contract.status}: ${tail}`,
  );
}

/** BE `requireRevisable`: hợp đồng nháp của đơn nháp. */
export function requireRevisable(contract: MockContract, order: Wf02Order): void {
  requireStatus(contract, "DRAFT", "edited");
  requireDraftOrder(order);
}

/* ── Body `SalesContractRequests.Draft` ──────────────────────────────── */

interface DraftBody {
  version: number | null;
  freeSampleRounds: number | null;
  deliverySchedule: BatchEntry[] | null;
  paymentPlan: InstallmentEntry[] | null;
  returnWindowDays: number | null;
}

function readDraft(body: Record<string, unknown>, needsVersion: boolean): DraftBody {
  const errors: MockFieldError[] = [];
  const version = wholeNumber(body.version, 0);
  if (needsVersion && version === null)
    errors.push({ field: "version", message: "Cần version.", code: "NotNull" });
  const rounds = body.freeSampleRounds;
  if (rounds !== undefined && rounds !== null && wholeNumber(rounds, 0) === null)
    errors.push({ field: "freeSampleRounds", message: "Số nguyên từ 0.", code: "PositiveOrZero" });
  const window = body.returnWindowDays;
  const windowDays = wholeNumber(window, 1);
  if (window !== undefined && window !== null && (windowDays === null || windowDays > 365))
    errors.push({ field: "returnWindowDays", message: "Từ 1 đến 365 ngày.", code: "Max" });
  const rawSchedule = Array.isArray(body.deliverySchedule) ? body.deliverySchedule : null;
  const rawPlan = Array.isArray(body.paymentPlan) ? body.paymentPlan : null;
  if (rawSchedule && rawSchedule.length > MAX_ROWS)
    errors.push({ field: "deliverySchedule", message: `Tối đa ${MAX_ROWS} đợt.`, code: "Size" });
  if (rawPlan && rawPlan.length > MAX_ROWS)
    errors.push({ field: "paymentPlan", message: `Tối đa ${MAX_ROWS} đợt.`, code: "Size" });
  const deliverySchedule = rawSchedule?.map((raw, i): BatchEntry => {
    if (raw === null) return null;
    const batch = asRecord(raw);
    const lines = (Array.isArray(batch.lines) ? batch.lines : []).map((rawLine, j) => {
      if (rawLine === null) return null;
      const line = asRecord(rawLine);
      const cartons = numberOrNull(line.cartons);
      if (cartons === null)
        errors.push({
          field: `deliverySchedule[${i}].lines[${j}].cartons`,
          message: "Cần số thùng.",
          code: "NotNull",
        });
      return { orderLineId: text(line.orderLineId) || null, cartons };
    });
    return {
      windowStart: dayOrNull(batch.windowStart),
      windowEnd: dayOrNull(batch.windowEnd),
      lines,
    };
  });
  const paymentPlan = rawPlan?.map((raw, i): InstallmentEntry => {
    if (raw === null) return null;
    const entry = asRecord(raw);
    const name = text(entry.name);
    if (!name || name.length > 100)
      errors.push({
        field: `paymentPlan[${i}].name`,
        message: "Cần tên, tối đa 100 ký tự.",
        code: "NotBlank",
      });
    if (!text(entry.milestone))
      errors.push({ field: `paymentPlan[${i}].milestone`, message: "Cần mốc.", code: "NotBlank" });
    return {
      name,
      milestone: isMilestone(entry.milestone) ? entry.milestone : null,
      amount: numberOrNull(entry.amount),
      percent: numberOrNull(entry.percent),
      dueDays: numberOrNull(entry.dueDays),
      deliveryBatchSeq: numberOrNull(entry.deliveryBatchSeq),
    };
  });
  if (errors.length > 0) refuseInvalid(VALIDATION_MESSAGE, errors);
  return {
    version,
    freeSampleRounds: wholeNumber(rounds, 0),
    deliverySchedule: deliverySchedule ?? null,
    paymentPlan: paymentPlan ?? null,
    returnWindowDays: windowDays,
  };
}

function requireRounds(rounds: number): void {
  if (rounds < 0 || rounds > 100)
    refuseInvalid("Số lần in mẫu miễn phí là số nguyên, từ 0 đến 100.");
}

/**
 * Lịch thanh toán mặc định của khách (18 §3) → % tổng có thuế. Seed demo không có lịch mặc định nào cho hai khách WF-02,
 * nên như BE: một đợt 100% khi ký, tên "On signing" (chuỗi BE ghi cứng), Sale sửa sau.
 */
const DEFAULT_PLAN: InstallmentEntry[] = [
  {
    name: "On signing",
    milestone: "ON_SIGNING",
    amount: null,
    percent: 100,
    // BE PR #388 DEFAULT_ON_SIGNING_DUE_DAYS
    dueDays: 3,
    deliveryBatchSeq: null,
  },
];

const creditArgs = (order: Wf02Order) =>
  [
    creditApproved(order.customerId),
    creditTermsOf(order.customerId)?.creditTermDays ?? null,
  ] as const;

/* ── Các bước ────────────────────────────────────────────────────────── */

/** `POST /orders/{id}/contract` — body rỗng / thiếu trường = mặc định (14 §4.3 bước 11). */
export async function createContract(orderId: string, body: Record<string, unknown>) {
  const draft = readDraft(body, false);
  const order = await orderOf(orderId, true);
  if (liveContractOf(order.orderId))
    conflict(
      "SALES_CONTRACT_EXISTS",
      `Đơn ${order.orderNumber} đã có hợp đồng còn hiệu lực: huỷ hợp đồng đó rồi mới lập hợp đồng khác.`,
    );
  // Bên mua theo hồ sơ pháp lý đã lưu (khách mới: chưa có → 409 cho tới khi Sale nhập hồ sơ).
  const buyer = legalBuyerOf(order.customerId);
  if (!buyer)
    conflict(
      "CUSTOMER_LEGAL_PROFILE_MISSING",
      `Khách của đơn ${order.orderNumber} chưa có hồ sơ pháp lý: nhập địa chỉ đăng ký kinh doanh và người đại diện trước.`,
    );
  requireDraftOrder(order);
  const batches = draft.deliverySchedule
    ? schedule(order, draft.deliverySchedule)
    : defaultSchedule(order);
  const installments = plan(
    order,
    batches.length,
    draft.paymentPlan ?? DEFAULT_PLAN,
    ...creditArgs(order),
  );
  const rounds = draft.freeSampleRounds ?? DEFAULT_FREE_SAMPLE_ROUNDS;
  requireRounds(rounds);
  const returnWindowDays = draft.returnWindowDays ?? DEFAULT_RETURN_WINDOW_DAYS;
  const count = mockContracts().filter((c) => c.orderId === order.orderId).length;
  const contract: MockContract = {
    id: crypto.randomUUID(),
    contractNumber: `HD-${order.orderNumber.slice(3)}-${count + 1}`,
    orderId: order.orderId,
    status: "DRAFT",
    seller: WF02_SELLER,
    buyer,
    freeSampleRounds: rounds,
    returnWindowDays,
    schedule: batches,
    plan: installments,
    sentAt: null,
    sentBy: null,
    sentDocumentKey: null,
    signedOn: null,
    signedFileName: null,
    signedFileKey: null,
    signedAt: null,
    signedBy: null,
    signedWithKey: null,
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: null,
    completedAt: null,
    version: 0,
    createdAt: new Date().toISOString(),
  };
  mockContracts().push(contract);
  return { order, contract };
}

/** `PUT /orders/{id}/contract` — chỉ nháp của đơn nháp; trường bỏ trống giữ như cũ, lịch thanh toán kiểm lại. */
export async function editContract(orderId: string, body: Record<string, unknown>) {
  const draft = readDraft(body, true);
  const { order, contract } = await loadContract(orderId);
  // BE: trạng thái trước (BR-14) — hợp đồng đã gửi không sửa, dù body mang gì — rồi mới tới version
  requireRevisable(contract, order);
  requireVersion(contract, draft.version ?? -1);
  const batches = draft.deliverySchedule
    ? schedule(order, draft.deliverySchedule)
    : contract.schedule;
  const installments = plan(
    order,
    batches.length,
    draft.paymentPlan ?? contract.plan.map(entryOf),
    ...creditArgs(order),
  );
  const rounds = draft.freeSampleRounds ?? contract.freeSampleRounds;
  requireRounds(rounds);
  Object.assign(contract, {
    schedule: batches,
    plan: installments,
    freeSampleRounds: rounds,
    returnWindowDays: draft.returnWindowDays ?? contract.returnWindowDays,
    version: contract.version + 1,
  });
  return { order, contract };
}

/** `GET …/payment-plan-suggestion` — tiền đợt gắn đợt giao theo giá trị hàng của đợt; không lưu. */
export async function suggestPlan(orderId: string) {
  const { order, contract } = await loadContract(orderId);
  requireRevisable(contract, order);
  const suggested = suggestTied(order, contract.schedule, contract.plan.map(entryOf));
  return {
    contract,
    plan: plan(order, contract.schedule.length, suggested, ...creditArgs(order)),
    order,
  };
}

/** 15 BR-12: trả sau giao cần hạn mức — kiểm lại lúc gửi. */
function requireCreditFor(order: Wf02Order, contract: MockContract): void {
  if (
    contract.plan.some((i) => i.milestone === "AFTER_DELIVERY") &&
    !creditApproved(order.customerId)
  )
    conflict(
      "PAYMENT_SCHEDULE_NEEDS_CREDIT",
      `Hợp đồng ${contract.contractNumber} có đợt thanh toán sau giao, nhưng hiện khách không còn hạn mức công nợ được kế toán duyệt.`,
    );
}

/** `POST …/sending` — DRAFT → SENT, đơn → PENDING_CONTRACT (14 §4.3 bước 13). */
export async function sendContract(orderId: string, body: Record<string, unknown>) {
  const version = wholeNumber(body.version, 0);
  if (version === null)
    refuseInvalid(VALIDATION_MESSAGE, [
      { field: "version", message: "Cần version.", code: "NotNull" },
    ]);
  const { order, contract } = await loadContract(orderId, version);
  requireStatus(contract, "DRAFT", "sent");
  requireDraftOrder(order);
  requireWindows(contract.schedule, vnDay());
  requireCreditFor(order, contract);
  Object.assign(contract, {
    status: "SENT",
    sentAt: new Date().toISOString(),
    sentBy: WF02_USERS.sales,
    sentDocumentKey: `documents/${contract.contractNumber}.pdf`,
    version: contract.version + 1,
  });
  sendContractOf(order);
  return { order, contract };
}

interface FormLike {
  get(name: string): unknown;
  getAll(name: string): unknown[];
}

const isFormLike = (data: unknown): data is FormLike =>
  data !== null &&
  typeof data === "object" &&
  typeof (data as Partial<FormLike>).get === "function" &&
  typeof (data as Partial<FormLike>).getAll === "function";

interface Signature {
  version: number | null;
  signedOn: string | null;
  fileName: string | null;
  files: number;
}

/** Multipart `file` + `version` + `signedOn` (cách 1), hoặc JSON `{version, uploadId, signedOn}` (cách 2). */
function readSignature(data: unknown, body: Record<string, unknown>): Signature {
  // Nhận dạng theo hình (`get` / `getAll`): FormData của jsdom và của trình duyệt / Node là các lớp khác nhau
  if (isFormLike(data)) {
    const files = data.getAll("file");
    const first: unknown = files[0];
    const name = asRecord(first).name;
    return {
      version: wholeNumber(Number(data.get("version") ?? Number.NaN), 0),
      signedOn: dayOrNull(data.get("signedOn")),
      fileName: typeof name === "string" && name ? name : first ? "signed-contract.pdf" : null,
      files: files.length,
    };
  }
  // JSON (cách 2) — bean validation của `SalesContractRequests.Signature`. Gửi FormData mà không đặt Content-Type
  // multipart thì client (mặc định JSON) đổi nó thành JSON không có `uploadId` → BE cũng trả 400 ở đây.
  const uploadId = text(body.uploadId);
  const errors: MockFieldError[] = [];
  if (wholeNumber(body.version, 0) === null)
    errors.push({ field: "version", message: "Cần version.", code: "NotNull" });
  if (!uploadId) errors.push({ field: "uploadId", message: "Cần uploadId.", code: "NotNull" });
  if (!dayOrNull(body.signedOn))
    errors.push({ field: "signedOn", message: "Cần ngày ký.", code: "NotNull" });
  if (errors.length > 0) refuseInvalid(VALIDATION_MESSAGE, errors);
  return {
    version: wholeNumber(body.version, 0),
    signedOn: dayOrNull(body.signedOn),
    fileName: uploadId ? `${uploadId}.pdf` : null,
    files: uploadId ? 1 : 0,
  };
}

/**
 * `POST …/signature` — SENT → SIGNED (14 §4.3 bước 15; 15 BR-07, BR-11): kiểm tín dụng phần trả sau giao, đơn → ON_HOLD
 * (CREDIT) nếu không đạt, không thì PENDING_PAYMENT khi có đợt khi ký, còn lại CONFIRMED; mở các đợt thanh toán. Cùng
 * `Idempotency-Key` gửi lại → trả lại hợp đồng đã ký.
 */
export async function signContract(
  orderId: string,
  data: unknown,
  body: Record<string, unknown>,
  idempotencyKey: string | null,
) {
  const signature = readSignature(data, body);
  if (signature.version === null)
    refuseInvalid(VALIDATION_MESSAGE, [
      { field: "version", message: "Cần version.", code: "NotNull" },
    ]);
  if (signature.files !== 1 || signature.signedOn === null || signature.fileName === null)
    refuseInvalid("Cần đúng một file hợp đồng đã ký và ngày ký.");
  const replay = idempotencyKey
    ? mockContracts().find((c) => c.orderId === orderId && c.signedWithKey === idempotencyKey)
    : undefined;
  if (replay) return { order: await orderOf(orderId), contract: replay };
  const { order, contract } = await loadContract(orderId, signature.version);
  requireStatus(contract, "SENT", "signed");
  const today = vnDay();
  const sentDay = contract.sentAt ? vnDay(new Date(contract.sentAt)) : today;
  if (signature.signedOn > today || signature.signedOn < sentDay)
    refuseInvalid(
      `Hợp đồng ${contract.contractNumber}: ngày ký ${viDay(signature.signedOn)} không hợp lệ - không được trước ngày gửi (${viDay(sentDay)}) và không được sau hôm nay.`,
    );
  const signedAt = new Date().toISOString();
  Object.assign(contract, {
    status: "SIGNED",
    signedOn: signature.signedOn,
    signedFileName: signature.fileName,
    signedFileKey: `documents/signed/${contract.contractNumber}-${signature.fileName}`,
    signedAt,
    signedBy: WF02_USERS.sales,
    signedWithKey: idempotencyKey,
    version: contract.version + 1,
  });
  const check = creditCheckOf(order, contract);
  const paysOnSigning = contract.plan.some((i) => i.milestone === "ON_SIGNING");
  contractSignedOf(order, !!check && check.outcome !== "WITHIN_LIMIT", paysOnSigning);
  // 15 §4.1 bước 1 (4B-6): ký là mở đợt — đợt khi ký đến hạn ngay, các đợt khác chờ giao hàng
  mockInstallments().push(
    ...contract.plan.map((i) => ({
      installmentId: crypto.randomUUID(),
      contractId: contract.id,
      contractNumber: contract.contractNumber,
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      seq: i.seq,
      name: i.name,
      milestone: i.milestone,
      deliveryBatchSeq: i.deliveryBatchSeq,
      amount: i.amount,
      paidAmount: 0,
      reducedAmount: 0,
      currency: "VND",
      dueDays: i.dueDays,
      reachedAt: i.milestone === "ON_SIGNING" ? signedAt : null,
      dueDate:
        i.milestone === "ON_SIGNING" ? addDays(signature.signedOn ?? today, i.dueDays ?? 0) : null,
      cancelled: false,
    })),
  );
  return { order, contract };
}

/** `POST …/cancellation` — DRAFT / SENT → CANCELLED, đơn chờ ký về DRAFT để lập lại (14 §4.3 bước 16). */
export async function cancelContract(orderId: string, body: Record<string, unknown>) {
  const errors: MockFieldError[] = [];
  const version = wholeNumber(body.version, 0);
  const reason = text(body.reason);
  if (version === null) errors.push({ field: "version", message: "Cần version.", code: "NotNull" });
  if (!reason || reason.length > 500)
    errors.push({ field: "reason", message: "Cần lý do (tối đa 500 ký tự).", code: "Size" });
  if (errors.length > 0) refuseInvalid(VALIDATION_MESSAGE, errors);
  const { order, contract } = await loadContract(orderId, version ?? -1);
  if (contract.status !== "DRAFT" && contract.status !== "SENT")
    conflict(
      "SALES_CONTRACT_STATUS_INVALID",
      `Hợp đồng ${contract.contractNumber} đang ở trạng thái ${contract.status}: chỉ huỷ được hợp đồng nháp hoặc đã gửi.`,
    );
  Object.assign(contract, {
    status: "CANCELLED",
    cancellationReason: reason,
    cancelledAt: new Date().toISOString(),
    cancelledBy: WF02_USERS.sales,
    version: contract.version + 1,
  });
  withdrawContractOf(order);
  return { order, contract };
}

/** `GET …/document` (bản đã gửi) / `…/signed-file` (bản đã ký) → khoá file, hoặc từ chối như BE. */
export async function fileKeyOf(orderId: string, which: "document" | "signed-file") {
  const { contract } = await loadContract(orderId);
  if (which === "document" && !contract.sentDocumentKey)
    conflict("SALES_CONTRACT_STATUS_INVALID", `Hợp đồng ${contract.contractNumber} chưa được gửi.`);
  if (which === "signed-file" && !contract.signedFileKey)
    conflict("SALES_CONTRACT_STATUS_INVALID", `Hợp đồng ${contract.contractNumber} chưa được ký.`);
  return which === "document" ? contract.sentDocumentKey : contract.signedFileKey;
}
