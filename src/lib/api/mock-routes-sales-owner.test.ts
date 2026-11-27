/**
 * Mock Sale phụ trách (hợp đồng sales-owner) chạy qua axios thật + lớp api của FE: mock đúng hình BE và parse được;
 * quyền theo `mock-user-grants`; chuyển hàng loạt idempotent theo `requestId` (BR-S09); khách đã đổi tay bị bỏ qua
 * (ca #9); đổi người phụ trách kiểm `version` (ca #15).
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { listCustomers } from "@/features/customer/api";
import { listTemporaryBatches, transferCustomers } from "@/features/sales-owner/api";
import {
  contactLead,
  createCover,
  getLeadHistory,
  listCovers,
  listLeads,
} from "@/features/sales-owner/work-api";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { useAuthStore } from "@/lib/auth/auth-store";
import { fetchSalesAgents } from "@/lib/references/sales-agents";
import { changeSalesOwner, getSalesOwnerDetail } from "@/lib/references/sales-owner";
import { fetchSalesWorkload } from "@/lib/references/sales-workload";

import { activateMockAdapter } from "./mock-adapter";
import { mockActorId } from "./mock-display-names";
import { mockSalesRoster, resetSalesOwnerMockStore } from "./mock-sales-owner-store";
import { resetSalesWorkMockStore } from "./mock-routes-sales-work";

const originalAdapter = api.defaults.adapter;

function actAs(userId: string) {
  useAuthStore.setState({
    user: {
      userId,
      fullName: "T",
      email: "t@t.vn",
      roles: [],
      username: "t",
      status: "ACTIVE",
      lastLoginAt: null,
      mustChangePassword: false,
    },
    isAuthenticated: true,
    status: "authenticated",
  });
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error: unknown) {
    if (error instanceof ApiError) return error.code;
    throw error;
  }
  throw new Error("Expected request to fail");
}

beforeAll(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  activateMockAdapter();
});
beforeEach(() => actAs("USER-ADMIN-01"));
afterEach(() => {
  resetSalesOwnerMockStore();
  resetSalesWorkMockStore();
});
afterAll(() => {
  api.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

describe("mock sales-owner", () => {
  it("GET /customers có cột Sale phụ trách và lọc salesOwnerState", async () => {
    const page = await listCustomers({ page: 0, size: 50, salesOwnerState: "NEEDS_ASSIGNMENT" });
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((c) => c.salesOwnerState === "NEEDS_ASSIGNMENT")).toBe(true);
  });

  it("ca #15: PUT với version cũ → SALES_OWNER_VERSION_CONFLICT", async () => {
    const [workload, page] = await Promise.all([
      fetchSalesWorkload(),
      listCustomers({ page: 0, size: 5 }),
    ]);
    const customerId = page.items[0]?.customerId ?? "";
    const owner = await getSalesOwnerDetail(customerId);
    const target = workload?.find((row) => row.userId !== owner?.salesOwnerId)?.userId ?? "";
    const input = {
      customerId,
      salesOwnerId: target,
      reason: "WORKLOAD" as const,
      note: "",
      notifyCustomer: true,
    };
    await changeSalesOwner({ ...input, version: owner?.version ?? 0 });
    expect(await codeOf(changeSalesOwner({ ...input, version: owner?.version ?? 0 }))).toBe(
      "SALES_OWNER_VERSION_CONFLICT",
    );
  });

  it("BR-S09: cùng requestId chạy lại trả đúng kết quả cũ, không chuyển lần hai", async () => {
    const workload = (await fetchSalesWorkload()) ?? [];
    const [from, to] = [workload[0]?.userId ?? "", workload[1]?.userId ?? ""];
    const body = {
      requestId: "req-1",
      fromUserId: from,
      toUserIds: [to],
      reason: "WORKLOAD" as const,
      note: "",
      temporary: false,
      notifyCustomer: true,
    };
    const first = await transferCustomers(body);
    const again = await transferCustomers(body);
    expect(first.moved).toBeGreaterThan(0);
    expect(again).toEqual(first);
    const left = await listCustomers({ page: 0, size: 200, salesOwnerId: from });
    expect(left.items).toHaveLength(0);
  });

  it("BR-S09: cùng requestId mà khác nội dung → SALES_OWNER_TRANSFER_REQUEST_REUSED, không chuyển", async () => {
    const workload = (await fetchSalesWorkload()) ?? [];
    const [from, to, third] = workload.map((row) => row.userId);
    const body = {
      requestId: "req-2",
      fromUserId: from ?? "",
      toUserIds: [to ?? ""],
      reason: "WORKLOAD" as const,
      note: "",
      temporary: false,
      notifyCustomer: true,
    };
    await transferCustomers(body);
    expect(
      await codeOf(transferCustomers({ ...body, toUserIds: [third ?? to ?? ""], note: "khác" })),
    ).toBe("SALES_OWNER_TRANSFER_REQUEST_REUSED");
  });

  it("BR-S09: hơn 500 khách trong một lô → SALES_OWNER_TRANSFER_TOO_LARGE", async () => {
    const workload = (await fetchSalesWorkload()) ?? [];
    expect(
      await codeOf(
        transferCustomers({
          requestId: "req-3",
          fromUserId: workload[0]?.userId ?? "",
          toUserIds: [workload[1]?.userId ?? ""],
          customerIds: Array.from({ length: 501 }, (_, i) => `c-${i}`),
          reason: "WORKLOAD",
          note: "",
          temporary: false,
          notifyCustomer: true,
        }),
      ),
    ).toBe("SALES_OWNER_TRANSFER_TOO_LARGE");
  });

  it("review S3: Sale chỉ thấy lịch mình vắng hoặc mình lo thay; quản lý thấy mọi lịch", async () => {
    const me = mockActorId("USER-SALE-01");
    const others = (await mockSalesRoster()).filter((p) => p.id !== me);
    expect(others.length).toBeGreaterThanOrEqual(2);
    await createCover({
      userId: others[0]?.id ?? "",
      coverUserId: others[1]?.id ?? "",
      from: "2099-01-01",
      to: "2099-01-10",
      reason: "Việc riêng",
    });
    const all = (await listCovers({})) ?? [];
    actAs("USER-SALE-01");
    const mine = (await listCovers({})) ?? [];
    const visible = all.filter((c) => c.userId === me || c.coverUserId === me);
    expect(mine.map((c) => c.id)).toEqual(visible.map((c) => c.id));
    expect(mine.length).toBeLessThan(all.length);
  });

  it("§10.7: lịch sử lead — lần gửi form, khách gửi lại (RESUBMITTED, kèm liên hệ), rồi thao tác của Sale", async () => {
    const leads = await listLeads({ page: 0, size: 20 });
    const first = leads.items.find((l) => l.companyName.includes("Lá Xanh"));
    const history = (await getLeadHistory(first?.id ?? "")) ?? [];
    // Jackson non_null: lần gửi form đầu không có `fromStatus`
    expect(history[0]?.fromStatus ?? null).toBeNull();
    expect(history[0]).toMatchObject({ toStatus: "NEW", kind: "CHANGE" });
    const resubmitted = history.find((row) => row.kind === "RESUBMITTED");
    expect(resubmitted?.note).toMatch(/contact .*phone .*e-mail/);
    const assigned = leads.items.find((l) => l.status === "ASSIGNED");
    await contactLead({ id: assigned?.id ?? "", note: "Đã gọi" });
    const after = (await getLeadHistory(assigned?.id ?? "")) ?? [];
    expect(after.at(-1)).toMatchObject({
      fromStatus: "ASSIGNED",
      toStatus: "CONTACTED",
      note: "Đã gọi",
      kind: "CHANGE",
    });
  });

  it("Sale không có customer-sales-owners:UPDATE → 403; chỉ thấy lead của mình", async () => {
    actAs("USER-SALE-01");
    expect(
      await codeOf(
        transferCustomers({
          requestId: "x",
          fromUserId: "a",
          toUserIds: ["b"],
          reason: "WORKLOAD",
          note: "",
          temporary: false,
          notifyCustomer: false,
        }),
      ),
    ).toBe("FORBIDDEN");
    const leads = await listLeads({ page: 0, size: 20 });
    expect(leads.items.every((l) => l.status !== "NEW")).toBe(true);
  });

  it("D42: GET /customers/sales-agents = Sale đang làm, không người điều phối; Sale cũng đọc được", async () => {
    const agents = (await fetchSalesAgents()) ?? [];
    const workload = (await fetchSalesWorkload()) ?? [];
    expect(agents.map((a) => a.userId)).toEqual(workload.map((w) => w.userId));
    expect(agents.some((a) => a.onLeave && a.coverUntil)).toBe(true);
    actAs("USER-SALE-01");
    expect((await fetchSalesAgents())?.length).toBe(agents.length);
  });

  it("D41: GET /customers có taxCodeMissing và lọc taxCodeMissing=true", async () => {
    const all = await listCustomers({ page: 0, size: 50 });
    expect(all.items.every((c) => typeof c.taxCodeMissing === "boolean")).toBe(true);
    const missing = await listCustomers({ page: 0, size: 50, taxCodeMissing: true });
    expect(missing.items.length).toBeGreaterThan(0);
    expect(missing.items.every((c) => c.taxCodeMissing === true && !c.taxCode)).toBe(true);
  });

  it("hợp đồng: lịch thay có status; lô tạm chỉ cho người có customer-sales-owners:UPDATE", async () => {
    const covers = (await listCovers({})) ?? [];
    expect(
      covers.every((c) => ["ACTIVE", "UPCOMING", "ENDED", "CANCELLED"].includes(c.status ?? "")),
    ).toBe(true);
    expect(await listTemporaryBatches()).toEqual([]);
    actAs("USER-SALE-01");
    expect(await listTemporaryBatches()).toBeNull();
  });
});
