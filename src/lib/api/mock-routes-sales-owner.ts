/**
 * Mock routes — Sale phụ trách khách (hợp đồng API sales-owner): người phụ trách một khách, lịch sử, chuyển hàng loạt
 * (idempotent theo `requestId`), trả lô tạm, bảng tải (BE-C) + số chat (BE-B), cài đặt phân công. Quyền theo
 * `mock-user-grants` (như `@RequiresPermission`); lỗi theo mã của hợp đồng.
 */

import {
  SALES_OWNER_ERROR_CODES,
  SALES_OWNER_LIMITS,
  SALES_OWNER_PERMISSIONS,
  SALES_WORKLOAD_PERMISSIONS,
  STAFF_COVER_PERMISSIONS,
} from "@/constants/sales-owner";

import { registerMockRoute } from "./mock-adapter";
import { chatCaller, chatState, firstResponseOverdue, isEndedStatus } from "./mock-chat-store";
import { activeCoverOf, registerSalesWorkMockRoutes } from "./mock-routes-sales-work";
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

/** `GET /customers/{id}/sales-owner` của một khách — cũng là tên người phụ trách ở `/customers/duplicates`. */
export async function ownerView(customerId: string) {
  const s = await salesOwnerStore();
  const owner = s.owners.get(customerId);
  if (!owner) return null;
  const roster = await mockSalesRoster();
  const active = roster.some((p) => p.id === owner.ownerId);
  const cover = owner.ownerId && active ? await activeCoverOf(owner.ownerId) : null;
  return {
    customerId,
    salesOwnerId: owner.ownerId,
    salesOwnerName: await mockPersonName(owner.ownerId),
    active: owner.ownerId ? active : null,
    state: owner.state,
    since: owner.since,
    cover,
    version: owner.version,
  };
}

/** Cột "Sale phụ trách" của `GET /customers` (BE-A) — gọi từ route danh sách khách. */
export async function salesOwnerFields(customerId: string) {
  const view = await ownerView(customerId);
  if (!view) return {};
  return {
    salesOwnerId: view.salesOwnerId,
    salesOwnerName: view.salesOwnerName,
    salesOwnerActive: view.active,
    salesOwnerState: view.state,
    salesOwnerSince: view.since,
  };
}

/** Lọc `mine` / `salesOwnerState` / `salesOwnerId` của `GET /customers`. */
export async function salesOwnerFilter(query: URLSearchParams) {
  const s = await salesOwnerStore();
  const me = query.get("mine") === "true" ? (await chatCaller())?.id : null;
  const state = query.get("salesOwnerState");
  const ownerId = query.get("salesOwnerId");
  return (customerId: string) => {
    const owner = s.owners.get(customerId);
    if (me && (owner?.ownerId !== me || owner.state !== "ASSIGNED")) return false;
    if (state && owner?.state !== state) return false;
    return !(ownerId && owner?.ownerId !== ownerId);
  };
}

async function getOwner(config: AxiosRequestConfig) {
  const caller = await callerWith(SALES_OWNER_PERMISSIONS.read);
  if (typeof caller !== "string") return caller;
  const view = await ownerView(pathParams(config).customerId ?? "");
  return view ? ok(view) : fail(404, "CUSTOMER_NOT_FOUND", "Không tìm thấy khách hàng.");
}

async function putOwner(config: AxiosRequestConfig) {
  const caller = await callerWith(SALES_OWNER_PERMISSIONS.update);
  if (typeof caller !== "string") return caller;
  const customerId = pathParams(config).customerId ?? "";
  const body = bodyOf(config);
  const s = await salesOwnerStore();
  const current = s.owners.get(customerId);
  if (!current) return fail(404, "CUSTOMER_NOT_FOUND", "Không tìm thấy khách hàng.");
  if (!text(body.reason)) return fail(400, "SALES_OWNER_CHANGE_REASON_REQUIRED", "Cần lý do.");
  if (body.version !== current.version)
    return fail(409, "SALES_OWNER_VERSION_CONFLICT", "Người phụ trách vừa được đổi.");
  const target = text(body.salesOwnerId);
  if (!(await mockSalesRoster()).some((p) => p.id === target))
    return fail(422, "SALES_OWNER_NOT_ASSIGNABLE", "Người này không phải Sale đang làm.");
  moveOwner(s, customerId, target, {
    reason: text(body.reason),
    note: text(body.note) || null,
    changedById: caller,
    batchId: null,
  });
  return ok(await ownerView(customerId));
}

async function getHistory(config: AxiosRequestConfig) {
  const caller = await callerWith(SALES_OWNER_PERMISSIONS.read);
  if (typeof caller !== "string") return caller;
  const query = queryOf(config);
  const rows = (await salesOwnerStore()).history.get(pathParams(config).customerId ?? "") ?? [];
  const named = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      fromName: await mockPersonName(row.fromUserId),
      toName: await mockPersonName(row.toUserId),
      changedByName: await mockPersonName(row.changedById),
    })),
  );
  return ok(pageOf(named, Number(query.get("page") ?? 0), Number(query.get("size") ?? 20)));
}

/** Nội dung của một yêu cầu chuyển (trừ `requestId`), thứ tự khách / người nhận không tính. */
function transferFingerprint(body: Record<string, unknown>): string {
  const list = (value: unknown) => (Array.isArray(value) ? value.map(String).sort() : null);
  return JSON.stringify([
    text(body.fromUserId),
    list(body.toUserIds),
    list(body.customerIds),
    text(body.reason),
    text(body.note),
    body.temporary === true,
    body.notifyCustomer !== false,
  ]);
}

/**
 * BR-S09: chia đều vòng tròn; khách không còn thuộc Sale A bị bỏ qua; chạy lại cùng `requestId` và cùng nội dung trả kết
 * quả cũ, khác nội dung → 409 `SALES_OWNER_TRANSFER_REQUEST_REUSED`; quá 500 khách (chọn tên hay cả sổ) → 422
 * `SALES_OWNER_TRANSFER_TOO_LARGE`.
 */
async function transfer(config: AxiosRequestConfig) {
  const caller = await callerWith(SALES_OWNER_PERMISSIONS.update);
  if (typeof caller !== "string") return caller;
  const body = bodyOf(config);
  const s = await salesOwnerStore();
  const requestId = text(body.requestId);
  const fingerprint = transferFingerprint(body);
  const replay = s.batches.find((b) => b.requestId === requestId);
  if (replay)
    return replay.fingerprint === fingerprint
      ? ok(replay.result)
      : fail(
          409,
          SALES_OWNER_ERROR_CODES.transferRequestReused,
          "Mã yêu cầu này đã dùng cho một lần chuyển khác; vui lòng gửi lại với mã mới",
        );
  const from = text(body.fromUserId);
  const to = Array.isArray(body.toUserIds) ? body.toUserIds.map(String) : [];
  const roster = await mockSalesRoster();
  if (!to.length || to.some((id) => !roster.some((p) => p.id === id)))
    return fail(422, "SALES_OWNER_NOT_ASSIGNABLE", "Có Sale nhận không còn làm.");
  if (!text(body.reason)) return fail(400, "SALES_OWNER_CHANGE_REASON_REQUIRED", "Cần lý do.");
  const picked = Array.isArray(body.customerIds) ? body.customerIds.map(String) : null;
  const ids = picked ?? [...s.owners].filter(([, o]) => o.ownerId === from).map(([id]) => id);
  if (ids.length > SALES_OWNER_LIMITS.transferMax)
    return fail(
      422,
      SALES_OWNER_ERROR_CODES.transferTooLarge,
      "Mỗi lần chuyển tối đa 500 khách; vui lòng chia thành nhiều lần và chọn khách cho từng lần",
    );
  const batchId = mockSalesId("ba7c0000");
  const skipped: { customerId: string; reason: string }[] = [];
  const moved: string[] = [];
  ids.forEach((customerId) => {
    if (s.owners.get(customerId)?.ownerId !== from)
      return void skipped.push({ customerId, reason: "NOT_OWNED_BY_SOURCE" });
    const target = to[moved.length % to.length] ?? from;
    moveOwner(s, customerId, target, {
      reason: text(body.reason),
      note: text(body.note) || null,
      changedById: caller,
      batchId,
    });
    moved.push(customerId);
  });
  const result = { batchId, moved: moved.length, skipped };
  s.batches.unshift({
    batchId,
    requestId,
    fingerprint,
    fromUserId: from,
    toUserIds: to,
    customerIds: moved,
    reason: text(body.reason),
    note: text(body.note),
    temporary: body.temporary === true,
    createdAt: new Date().toISOString(),
    createdById: caller,
    returnedAt: null,
    result,
  });
  return ok(result);
}

/** Hợp đồng (phần BO-1): `?temporary=true`, `customer-sales-owners:UPDATE`. */
async function listBatches(config: AxiosRequestConfig) {
  const caller = await callerWith(SALES_OWNER_PERMISSIONS.update);
  if (typeof caller !== "string") return caller;
  const s = await salesOwnerStore();
  const temporaryOnly = queryOf(config).get("temporary") === "true";
  const rows = await Promise.all(
    s.batches
      .filter((b) => !temporaryOnly || b.temporary)
      .map(async (b) => ({
        batchId: b.batchId,
        fromUserId: b.fromUserId,
        fromName: await mockPersonName(b.fromUserId),
        toNames: (await Promise.all(b.toUserIds.map(mockPersonName))).filter(Boolean),
        reason: b.reason,
        note: b.note,
        temporary: b.temporary,
        createdAt: b.createdAt,
        createdByName: await mockPersonName(b.createdById),
        moved: b.customerIds.length,
        stillHeld: b.customerIds.filter((id) =>
          b.toUserIds.includes(s.owners.get(id)?.ownerId ?? ""),
        ).length,
        returnedAt: b.returnedAt,
      })),
  );
  return ok(rows);
}

/** §10.1: chỉ khách còn ở người nhận của lô mới về lại; khách đã chuyển tiếp thì bỏ qua. */
async function returnBatch(config: AxiosRequestConfig) {
  const caller = await callerWith(SALES_OWNER_PERMISSIONS.update);
  if (typeof caller !== "string") return caller;
  const s = await salesOwnerStore();
  const batch = s.batches.find((b) => b.batchId === pathParams(config).batchId);
  if (!batch?.temporary) return fail(404, "NOT_FOUND", "Không tìm thấy lô tạm.");
  if (batch.returnedAt) return fail(409, "CONFLICT", "Lô đã được trả.");
  const skipped: { customerId: string; reason: string }[] = [];
  let moved = 0;
  for (const customerId of batch.customerIds) {
    if (!batch.toUserIds.includes(s.owners.get(customerId)?.ownerId ?? "")) {
      skipped.push({ customerId, reason: "REASSIGNED_SINCE" });
      continue;
    }
    moveOwner(s, customerId, batch.fromUserId, {
      reason: "RETURN_FROM_LEAVE",
      note: null,
      changedById: caller,
      batchId: batch.batchId,
    });
    moved += 1;
  }
  batch.returnedAt = new Date().toISOString();
  return ok({ batchId: batch.batchId, moved, skipped });
}

/** BE-C bảng tải: số khách từ store; số liệu mock không có (đơn, báo giá, doanh số) để trống — không bịa. */
async function workload() {
  const caller = await callerWith(SALES_WORKLOAD_PERMISSIONS.read);
  if (typeof caller !== "string") return caller;
  const s = await salesOwnerStore();
  const month = new Date().toISOString().slice(0, 7);
  const rows = await Promise.all(
    (await mockSalesRoster()).map(async (p) => {
      const owned = [...s.owners.values()].filter(
        (o) => o.ownerId === p.id && o.state === "ASSIGNED",
      );
      const settings = s.settings.get(p.id);
      const cover = await activeCoverOf(p.id);
      return {
        userId: p.id,
        name: p.name,
        paused: settings?.paused ?? false,
        capacityPerMonth: settings?.capacityPerMonth ?? null,
        onLeave: !!cover,
        coverName: cover?.name ?? null,
        coverUntil: cover?.until ?? null,
        customers: owned.length,
        newCustomersThisMonth: owned.filter((o) => o.since?.startsWith(month)).length,
      };
    }),
  );
  return ok(rows);
}

/**
 * D42 `GET /customers/sales-agents` (`customer-sales-owners:READ` hoặc `staff-covers:READ`): Sale đang làm, không người
 * điều phối (`mockSalesRoster`) — cùng người mà `PUT …/sales-owner` / chuyển lô / lịch thay nhận.
 */
async function salesAgents() {
  const caller = await chatCaller();
  if (!caller) return fail(401, "UNAUTHORIZED", "Unauthorized");
  if (!caller.can(SALES_OWNER_PERMISSIONS.read) && !caller.can(STAFF_COVER_PERMISSIONS.read))
    return fail(403, "FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
  const s = await salesOwnerStore();
  const rows = await Promise.all(
    (await mockSalesRoster()).map(async (p) => {
      const cover = await activeCoverOf(p.id);
      return {
        userId: p.id,
        name: p.name,
        paused: s.settings.get(p.id)?.paused ?? false,
        onLeave: !!cover,
        coverUntil: cover?.until ?? null,
      };
    }),
  );
  return ok(rows);
}

/** BE-B: hội thoại chưa kết thúc / trễ phản hồi đầu theo Sale đang phụ trách. */
async function chatWorkload() {
  const caller = await callerWith(SALES_WORKLOAD_PERMISSIONS.read);
  if (typeof caller !== "string") return caller;
  const now = Date.now();
  const open = chatState().conversations.filter((c) => !isEndedStatus(c.status));
  return ok(
    (await mockSalesRoster()).map((p) => {
      const mine = open.filter((c) => c.assignedAgentId === p.id);
      return {
        userId: p.id,
        openConversations: mine.length,
        overdueConversations: mine.filter((c) => firstResponseOverdue(c, now)).length,
      };
    }),
  );
}

async function putSettings(config: AxiosRequestConfig) {
  const caller = await callerWith(SALES_OWNER_PERMISSIONS.update);
  if (typeof caller !== "string") return caller;
  const body = bodyOf(config);
  const settings = {
    paused: body.paused === true,
    capacityPerMonth: typeof body.capacityPerMonth === "number" ? body.capacityPerMonth : null,
  };
  (await salesOwnerStore()).settings.set(pathParams(config).userId ?? "", settings);
  return ok(settings);
}

export function registerSalesOwnerMockRoutes(): void {
  // Trước `/customers/:customerId` (khớp theo thứ tự đăng ký)
  registerMockRoute("GET", "/customers/sales-agents", salesAgents);
  registerMockRoute("GET", "/customers/sales-owner-transfers", listBatches);
  registerMockRoute("POST", "/customers/sales-owner-transfers", transfer);
  registerMockRoute("POST", "/customers/sales-owner-transfers/:batchId/return", returnBatch);
  registerMockRoute("GET", "/customers/:customerId/sales-owner", getOwner);
  registerMockRoute("PUT", "/customers/:customerId/sales-owner", putOwner);
  registerMockRoute("GET", "/customers/:customerId/sales-owner-history", getHistory);
  registerMockRoute("GET", "/sales/workload", workload);
  registerMockRoute("GET", "/chat/agents/workload", chatWorkload);
  registerMockRoute("PUT", "/sales/staff/:userId/assignment-settings", putSettings);
  registerSalesWorkMockRoutes();
}
