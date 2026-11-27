/**
 * Mock routes — lịch người thay (BR-S07), khách tiềm năng (§10.7), yêu cầu đổi Sale (§10.5) của hợp đồng sales-owner.
 * Luật lỗi theo hợp đồng: `STAFF_COVER_OVERLAP` / `_TOO_LONG` / `_SELF`, `LEAD_ALREADY_HANDLED`, ghi chú bắt buộc khi từ
 * chối. Chỉ USE_MOCK=true.
 */

import {
  OWNER_CHANGE_REQUEST_PERMISSIONS,
  SALES_LEAD_PERMISSIONS,
  SALES_OWNER_PERMISSIONS,
  STAFF_COVER_PERMISSIONS,
} from "@/constants/sales-owner";

import { registerMockRoute } from "./mock-adapter";
import { chatCaller } from "./mock-chat-store";
import { allMockCustomers } from "./mock-customer-store";
import { bodyOf, fail, ok, pageOf, pathParams, queryOf, text } from "./mock-route-utils";
import {
  callerWith,
  mockPersonName,
  mockSalesId,
  mockSalesRoster,
  moveOwner,
  salesOwnerStore,
} from "./mock-sales-owner-store";

import type { AxiosRequestConfig } from "axios";

interface Cover {
  id: string;
  userId: string;
  coverUserId: string;
  from: string;
  to: string;
  reason: string;
  cancelledAt: string | null;
}
export interface Lead {
  id: string;
  companyName: string;
  taxCode: string;
  contactName: string;
  phone: string;
  email: string;
  province: string;
  interests: string[];
  status: string;
  assignedTo: string | null;
  createdAt: string;
  contactNote?: string;
  disqualifyReason?: string;
  customerId?: string;
}
interface Request {
  id: string;
  customerId: string;
  preferredSalesUserId: string | null;
  preferredSalesRecentlyContacted: boolean;
  reason: string;
  note: string;
  status: string;
  createdAt: string;
  decisionNote?: string;
  decidedAt?: string;
}

const day = (offset: number) =>
  new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
let work: { covers: Cover[]; leads: Lead[]; requests: Request[] } | null = null;

export function resetSalesWorkMockStore(): void {
  work = null;
}

async function state() {
  if (work) return work;
  const roster = await mockSalesRoster();
  const [a, b] = [roster[0]?.id ?? "", roster[1]?.id ?? roster[0]?.id ?? ""];
  const customers = allMockCustomers();
  const lead = (n: number, name: string, status: string, assignedTo: string | null): Lead => ({
    id: mockSalesId("1ead0000"),
    companyName: name,
    taxCode: `031${String(7_000_000 + n).padStart(7, "0")}`,
    contactName: `Người liên hệ ${n}`,
    phone: `0908${String(100_000 + n).padStart(6, "0")}`,
    email: `lienhe${n}@doanhnghiep-demo.vn`,
    province: n % 2 ? "TP. Hồ Chí Minh" : "Hà Nội",
    interests: n % 2 ? ["CUP", "BAG"] : ["BOX"],
    status,
    assignedTo,
    createdAt: new Date(Date.now() - n * 3_600_000).toISOString(),
  });
  work = {
    covers:
      a && b && a !== b
        ? [
            {
              id: mockSalesId("c0e40000"),
              userId: a,
              coverUserId: b,
              from: day(-2),
              to: day(5),
              reason: "Nghỉ phép",
              cancelledAt: null,
            },
          ]
        : [],
    leads: [
      lead(1, "Công ty TNHH Trà Sữa Lá Xanh", "NEW", null),
      lead(2, "Quán Cà Phê Gió Sớm", "NEW", null),
      lead(3, "Công ty CP Bánh Ngọt Mùa Thu", "ASSIGNED", a || null),
      lead(4, "Cửa hàng Kem Tuyết Trắng", "CONTACTED", a || null),
    ],
    requests: customers.slice(0, 2).map((c, i) => ({
      id: mockSalesId("4e90e000"),
      customerId: c.customerId,
      preferredSalesUserId: b || null,
      preferredSalesRecentlyContacted: i === 0,
      reason: i === 0 ? "SLOW_RESPONSE" : "PREFER_KNOWN_CONTACT",
      note:
        i === 0 ? "Hỏi giá hai ngày chưa thấy trả lời." : "Đã làm việc với Sale này ở công ty cũ.",
      status: "PENDING",
      createdAt: new Date(Date.now() - (i + 1) * 7_200_000).toISOString(),
    })),
  };
  return work;
}

const today = () => day(0);
const coverActive = (c: Cover) => !c.cancelledAt && c.from <= today() && c.to >= today();

/** Hợp đồng (phần BO-1): trạng thái lịch thay `ACTIVE` / `UPCOMING` / `ENDED` / `CANCELLED`. */
function coverStatus(c: Cover): string {
  if (c.cancelledAt) return "CANCELLED";
  if (c.to < today()) return "ENDED";
  return c.from > today() ? "UPCOMING" : "ACTIVE";
}

/** §10.7: lead mà `POST /customers` (mock) chuyển thành khách; cùng một đối tượng, route tạo khách đổi trạng thái. */
export async function mockLead(leadId: string): Promise<Lead | null> {
  return (await state()).leads.find((l) => l.id === leadId) ?? null;
}

/** Lead đang mở (ASSIGNED / CONTACTED) của một Sale — cho `handover-summary` (D44). */
export async function openLeadCountOf(userId: string): Promise<number> {
  return (await state()).leads.filter(
    (l) => l.assignedTo === userId && (l.status === "ASSIGNED" || l.status === "CONTACTED"),
  ).length;
}

/** Người đang lo thay cho `userId` hôm nay (thẻ khách, bảng tải). */
export async function activeCoverOf(userId: string) {
  const cover = (await state()).covers.find((c) => c.userId === userId && coverActive(c));
  return cover
    ? {
        userId: cover.coverUserId,
        name: (await mockPersonName(cover.coverUserId)) ?? "",
        until: cover.to,
      }
    : null;
}

async function listCovers(config: AxiosRequestConfig) {
  const caller = await callerWith(STAFF_COVER_PERMISSIONS.read);
  if (typeof caller !== "string") return caller;
  const query = queryOf(config);
  const rows = (await state()).covers.filter(
    (c) =>
      (!query.get("userId") || c.userId === query.get("userId")) &&
      (query.get("active") !== "true" || (!c.cancelledAt && c.to >= today())),
  );
  return ok(
    await Promise.all(
      rows.map(async (c) => ({
        ...c,
        userName: await mockPersonName(c.userId),
        coverUserName: await mockPersonName(c.coverUserId),
        status: coverStatus(c),
      })),
    ),
  );
}

async function createCover(config: AxiosRequestConfig) {
  const caller = await callerWith(STAFF_COVER_PERMISSIONS.create);
  if (typeof caller !== "string") return caller;
  const body = bodyOf(config);
  const [userId, coverUserId, from, to] = [body.userId, body.coverUserId, body.from, body.to].map(
    text,
  );
  const manager = (await chatCaller())?.can(SALES_OWNER_PERMISSIONS.update) ?? false;
  if (!manager && userId !== caller)
    return fail(403, "FORBIDDEN", "Sale chỉ lập lịch cho chính mình.");
  if (userId === coverUserId) return fail(422, "STAFF_COVER_SELF", "Không tự thay chính mình.");
  if (!(await mockSalesRoster()).some((p) => p.id === coverUserId))
    return fail(422, "SALES_OWNER_NOT_ASSIGNABLE", "Người thay phải là Sale đang làm.");
  if ((Date.parse(to) - Date.parse(from)) / 86_400_000 + 1 > 60)
    return fail(422, "STAFF_COVER_TOO_LONG", "Lịch thay tối đa 60 ngày.");
  const w = await state();
  if (w.covers.some((c) => c.userId === userId && !c.cancelledAt && c.from <= to && c.to >= from))
    return fail(409, "STAFF_COVER_OVERLAP", "Đã có lịch thay chồng ngày.");
  const cover = {
    id: mockSalesId("c0e40000"),
    userId,
    coverUserId,
    from,
    to,
    reason: text(body.reason),
    cancelledAt: null,
  };
  w.covers.unshift(cover);
  return ok(cover, 201);
}

async function cancelCover(config: AxiosRequestConfig) {
  const caller = await callerWith(STAFF_COVER_PERMISSIONS.update);
  if (typeof caller !== "string") return caller;
  const cover = (await state()).covers.find((c) => c.id === pathParams(config).id);
  if (!cover) return fail(404, "NOT_FOUND", "Không tìm thấy lịch.");
  cover.cancelledAt = new Date().toISOString();
  return ok(cover);
}

async function listLeads(config: AxiosRequestConfig) {
  const caller = await callerWith(SALES_LEAD_PERMISSIONS.read);
  if (typeof caller !== "string") return caller;
  const query = queryOf(config);
  const manager = (await chatCaller())?.can(SALES_OWNER_PERMISSIONS.update) ?? false;
  const rows = (await state()).leads.filter(
    (l) =>
      (manager || l.assignedTo === caller) &&
      (!query.get("status") || l.status === query.get("status")) &&
      (!query.get("assignedTo") || l.assignedTo === query.get("assignedTo")),
  );
  const named = await Promise.all(
    rows.map(async (l) => ({ ...l, assignedToName: await mockPersonName(l.assignedTo) })),
  );
  return ok(pageOf(named, Number(query.get("page") ?? 0), Number(query.get("size") ?? 20)));
}

function leadStep(
  next: string,
  allowed: readonly string[],
  apply: (lead: Lead, body: Record<string, unknown>) => void,
) {
  return async (config: AxiosRequestConfig) => {
    const caller = await callerWith(SALES_LEAD_PERMISSIONS.update);
    if (typeof caller !== "string") return caller;
    const lead = (await state()).leads.find((l) => l.id === pathParams(config).id);
    if (!lead) return fail(404, "NOT_FOUND", "Không tìm thấy khách tiềm năng.");
    if (!allowed.includes(lead.status))
      return fail(409, "LEAD_ALREADY_HANDLED", "Lead đã được xử lý.");
    apply(lead, bodyOf(config));
    lead.status = next;
    return ok({ ...lead, assignedToName: await mockPersonName(lead.assignedTo) });
  };
}

async function listRequests(config: AxiosRequestConfig) {
  const caller = await callerWith(OWNER_CHANGE_REQUEST_PERMISSIONS.read);
  if (typeof caller !== "string") return caller;
  const query = queryOf(config);
  const s = await salesOwnerStore();
  const rows = (await state()).requests.filter(
    (r) => !query.get("status") || r.status === query.get("status"),
  );
  const named = await Promise.all(
    rows.map(async (r) => {
      const owner = s.owners.get(r.customerId)?.ownerId ?? null;
      return {
        ...r,
        customerName:
          allMockCustomers().find((c) => c.customerId === r.customerId)?.fullName ?? null,
        currentOwnerId: owner,
        currentOwnerName: await mockPersonName(owner),
        preferredSalesName: await mockPersonName(r.preferredSalesUserId),
      };
    }),
  );
  return ok(pageOf(named, Number(query.get("page") ?? 0), Number(query.get("size") ?? 20)));
}

function decide(approve: boolean) {
  return async (config: AxiosRequestConfig) => {
    const caller = await callerWith(OWNER_CHANGE_REQUEST_PERMISSIONS.approve);
    if (typeof caller !== "string") return caller;
    const request = (await state()).requests.find((r) => r.id === pathParams(config).id);
    if (!request) return fail(404, "NOT_FOUND", "Không tìm thấy yêu cầu.");
    if (request.status !== "PENDING") return fail(409, "CONFLICT", "Yêu cầu đã được quyết định.");
    const body = bodyOf(config);
    if (!approve && !text(body.note)) return fail(400, "VALIDATION_FAILED", "Cần lý do từ chối.");
    if (approve) {
      const target = text(body.newSalesOwnerId);
      if (!(await mockSalesRoster()).some((p) => p.id === target))
        return fail(422, "SALES_OWNER_NOT_ASSIGNABLE", "Người này không phải Sale đang làm.");
      moveOwner(await salesOwnerStore(), request.customerId, target, {
        reason: "CUSTOMER_REQUEST",
        note: text(body.note) || null,
        changedById: caller,
        batchId: null,
      });
    }
    request.status = approve ? "APPROVED" : "REJECTED";
    request.decisionNote = text(body.note);
    request.decidedAt = new Date().toISOString();
    return ok(request);
  };
}

export function registerSalesWorkMockRoutes(): void {
  registerMockRoute("GET", "/staff-covers", listCovers);
  registerMockRoute("POST", "/staff-covers", createCover);
  registerMockRoute("POST", "/staff-covers/:id/cancellation", cancelCover);
  registerMockRoute("GET", "/leads", listLeads);
  registerMockRoute(
    "PUT",
    "/leads/:id/assignment",
    leadStep("ASSIGNED", ["NEW", "ASSIGNED", "CONTACTED"], (lead, body) => {
      lead.assignedTo = text(body.salesUserId);
    }),
  );
  registerMockRoute(
    "POST",
    "/leads/:id/contact",
    leadStep("CONTACTED", ["ASSIGNED"], (lead, body) => {
      lead.contactNote = text(body.note);
    }),
  );
  registerMockRoute(
    "POST",
    "/leads/:id/disqualification",
    leadStep("DISQUALIFIED", ["NEW", "ASSIGNED", "CONTACTED"], (lead, body) => {
      lead.disqualifyReason = text(body.reason);
    }),
  );
  registerMockRoute("GET", "/sales-owner-change-requests", listRequests);
  registerMockRoute("POST", "/sales-owner-change-requests/:id/approval", decide(true));
  registerMockRoute("POST", "/sales-owner-change-requests/:id/rejection", decide(false));
}
