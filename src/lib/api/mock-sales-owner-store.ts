/**
 * Mock Sale phụ trách khách (hợp đồng API sales-owner, BE-A / BE-B / BE-C) — chỉ USE_MOCK=true. Người: Sale trả lời chat
 * của mock (`chatPeople`, cùng nguồn `/chat/agents`); khách: 45 khách của `mock-customer-store`. Một store trong bộ nhớ,
 * gieo lần đầu dùng: khách chia vòng cho các Sale, vài khách "Cần giao" (người cũ là tài khoản seed không còn trả lời
 * chat) và "Chưa có người phụ trách", mỗi khách một dòng lịch sử `BACKFILL`. Hai khách của seed WF-02 (khách demo, Trà
 * Sữa Mây — báo giá / hợp đồng mock trỏ tới, không nằm trong `/customers`) theo đúng quy tắc điền dữ liệu của BE: người gửi
 * chứng từ gần nhất (`demo.sales`). MỘT store cho thẻ khách, danh sách, màn phân công và các màn chế độ chặt (báo giá, hợp
 * đồng, chat, hộp yêu cầu báo giá), nên một khách có cùng một người phụ trách ở mọi màn.
 */

import { SALES_OWNER_PERMISSIONS } from "@/constants/sales-owner";

import { getMockStaffUsers } from "./mock-adapter";
import { CHAT_SEED } from "./mock-chat-seed";
import { chatCaller, chatPeople } from "./mock-chat-store";
import { mockActorId } from "./mock-display-names";
import { allMockCustomers } from "./mock-customer-store";
import { fail } from "./mock-route-utils";
import { mockGrantsOf } from "./mock-user-grants";

import type { MockResponseShape } from "./mock-route-utils";

/** Người gọi có mã quyền → id của họ; không → 401 / 403 (như `@RequiresPermission`). */
export async function callerWith(code: string): Promise<string | MockResponseShape> {
  const caller = await chatCaller();
  if (!caller) return fail(401, "UNAUTHORIZED", "Unauthorized");
  return caller.can(code)
    ? caller.id
    : fail(403, "FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
}

export interface MockOwner {
  ownerId: string | null;
  state: "ASSIGNED" | "NEEDS_ASSIGNMENT" | "UNASSIGNED";
  since: string | null;
  version: number;
}

export interface MockHistory {
  id: string;
  fromUserId: string | null;
  toUserId: string | null;
  reason: string;
  note: string | null;
  changedById: string | null;
  changedAt: string;
  batchId: string | null;
}

export interface MockBatch {
  batchId: string;
  requestId: string;
  /** Nội dung yêu cầu (BE V20270128000470): cùng `requestId` mà khác nội dung → `SALES_OWNER_TRANSFER_REQUEST_REUSED`. */
  fingerprint: string;
  fromUserId: string;
  toUserIds: string[];
  customerIds: string[];
  reason: string;
  note: string;
  temporary: boolean;
  createdAt: string;
  createdById: string;
  returnedAt: string | null;
  result: { batchId: string; moved: number; skipped: { customerId: string; reason: string }[] };
}

interface Store {
  owners: Map<string, MockOwner>;
  history: Map<string, MockHistory[]>;
  batches: MockBatch[];
  settings: Map<string, { paused: boolean; capacityPerMonth: number | null }>;
}

let store: Store | null = null;
/** Ngày điền dữ liệu của hai khách seed WF-02. */
const SEED_SINCE = "2026-11-20T02:00:00Z";
let sequence = 0;

export function resetSalesOwnerMockStore(): void {
  store = null;
  sequence = 0;
}

/** Id dạng UUID ổn định trong một phiên mock. */
export function mockSalesId(prefix: string): string {
  sequence += 1;
  return `${prefix}-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
}

/**
 * Sale đang làm: người trả lời chat của mock mà không phải người điều phối (hợp đồng D42: người phụ trách / người thay
 * chỉ là SALES_STAFF đang làm; "quản lý" = người có `customer-sales-owners:UPDATE` — điều phối, không được giao), cộng
 * agent của seed chat. Xét theo mã quyền của tài khoản demo, không theo tên vai trò. Sắp theo tên.
 */
export async function mockSalesRoster(): Promise<{ id: string; name: string }[]> {
  const coordinators = new Set(
    (await getMockStaffUsers())
      .filter((user) => mockGrantsOf(user.userId).has(SALES_OWNER_PERMISSIONS.update))
      .map((user) => mockActorId(user.userId)),
  );
  const people = [...(await chatPeople()).values()].filter(
    (p) => p.agent && !coordinators.has(p.id),
  );
  return people
    .map(({ id, name }) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

export async function mockPersonName(id: string | null | undefined): Promise<string | null> {
  if (!id) return null;
  return (await chatPeople()).get(id)?.name ?? null;
}

export async function salesOwnerStore(): Promise<Store> {
  if (store) return store;
  const roster = await mockSalesRoster();
  const owners = new Map<string, MockOwner>();
  const history = new Map<string, MockHistory[]>();
  allMockCustomers().forEach((customer, index) => {
    const n = index + 1;
    const since = customer.createdAt;
    const owner: MockOwner =
      n % 11 === 0 || roster.length === 0
        ? { ownerId: null, state: "UNASSIGNED", since: null, version: 0 }
        : n % 9 === 0
          ? { ownerId: CHAT_SEED.salesChat, state: "NEEDS_ASSIGNMENT", since, version: 0 }
          : {
              ownerId: roster[index % roster.length]?.id ?? null,
              state: "ASSIGNED",
              since,
              version: 0,
            };
    owners.set(customer.customerId, owner);
    history.set(
      customer.customerId,
      owner.ownerId
        ? [
            {
              id: mockSalesId("5a1e0000"),
              fromUserId: null,
              toUserId: owner.ownerId,
              reason: "BACKFILL",
              note: null,
              changedById: null,
              changedAt: since,
              batchId: null,
            },
          ]
        : [],
    );
  });
  // Quy tắc điền dữ liệu của BE (hợp đồng "Backfill rule"): người gửi báo giá / hợp đồng gần nhất trong seed WF-02
  for (const customerId of [CHAT_SEED.demoCustomer, CHAT_SEED.traSuaMay]) {
    owners.set(customerId, {
      ownerId: CHAT_SEED.sales,
      state: "ASSIGNED",
      since: SEED_SINCE,
      version: 0,
    });
    history.set(customerId, [
      {
        id: mockSalesId("5a1e0000"),
        fromUserId: null,
        toUserId: CHAT_SEED.sales,
        reason: "BACKFILL",
        note: null,
        changedById: null,
        changedAt: SEED_SINCE,
        batchId: null,
      },
    ]);
  }
  store = { owners, history, batches: [], settings: new Map() };
  return store;
}

/** Đổi người phụ trách một khách + ghi lịch sử (BR-S03, BR-S06). */
export function moveOwner(
  s: Store,
  customerId: string,
  toUserId: string,
  entry: { reason: string; note: string | null; changedById: string; batchId: string | null },
): void {
  const current = s.owners.get(customerId);
  const now = new Date().toISOString();
  s.owners.set(customerId, {
    ownerId: toUserId,
    state: "ASSIGNED",
    since: now,
    version: (current?.version ?? 0) + 1,
  });
  s.history.set(customerId, [
    {
      id: mockSalesId("5a1e0000"),
      fromUserId: current?.ownerId ?? null,
      toUserId,
      changedAt: now,
      ...entry,
    },
    ...(s.history.get(customerId) ?? []),
  ]);
}
