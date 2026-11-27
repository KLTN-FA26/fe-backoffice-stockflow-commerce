import { describe, expect, it } from "vitest";

import { customerCreateFromLead } from "@/constants/sales-owner";

import { salesWorkloadRowSchema, suggestLeastLoaded } from "@/lib/references/sales-workload";
import { workloadRow } from "@/test/sales-owner-screen";

import { coverInputSchema, transferInputSchema } from "../inputs";
import {
  canCancelCover,
  canDecideRequest,
  LEAD_TRANSITIONS,
  leadActions,
  OWNER_CHANGE_REQUEST_TRANSITIONS,
} from "../lifecycle";
import { coverState, mergeWorkload } from "../selectors";
import { leadSchema, ownerChangeRequestSchema, staffCoverSchema } from "../schemas";

const lead = (status: string, assignedTo: string | null = null) =>
  leadSchema.parse({ id: "l-1", companyName: "Công ty X", status, assignedTo });
const ME = "u-me";
const manager = { userId: "u-mgr", canUpdate: true, isManager: true, canCreateCustomer: false };
const sales = { userId: ME, canUpdate: true, isManager: false, canCreateCustomer: true };
const other = { userId: "u-other", canUpdate: true, isManager: false, canCreateCustomer: true };

describe("Khách tiềm năng — vòng đời (§10.7 NEW → ASSIGNED → CONTACTED → CONVERTED / DISQUALIFIED)", () => {
  it("CONVERTED, DISQUALIFIED là kết thúc", () => {
    expect(LEAD_TRANSITIONS.CONVERTED).toEqual([]);
    expect(LEAD_TRANSITIONS.DISQUALIFIED).toEqual([]);
  });
  it("§10.4 quản lý: giao / loại lead mới; không liên hệ / chuyển hộ", () => {
    expect(leadActions(lead("NEW"), manager)).toEqual(["assign", "disqualify"]);
  });
  it("§10.7 Sale được giao: liên hệ, chuyển thành khách, loại; Sale khác không có thao tác", () => {
    expect(leadActions(lead("ASSIGNED", ME), sales)).toEqual(["contact", "convert", "disqualify"]);
    expect(leadActions(lead("CONTACTED", ME), sales)).toEqual(["convert", "disqualify"]);
    expect(leadActions(lead("ASSIGNED", ME), other)).toEqual([]);
  });
  it("BR-S16: quản lý tự nhận lead thì cũng có thao tác của Sale", () => {
    expect(leadActions(lead("ASSIGNED", "u-mgr"), manager)).toEqual([
      "assign",
      "contact",
      "disqualify",
    ]);
  });
  it("lead đã xong / trạng thái lạ / không có quyền sửa → không thao tác", () => {
    expect(leadActions(lead("CONVERTED", ME), sales)).toEqual([]);
    expect(leadActions(lead("ARCHIVED", ME), sales)).toEqual([]);
    expect(leadActions(lead("ASSIGNED", ME), { ...sales, canUpdate: false })).toEqual([]);
  });
});

describe("Yêu cầu đổi Sale (§10.5)", () => {
  const request = (status: string) =>
    ownerChangeRequestSchema.parse({ id: "r-1", customerId: "c-1", status });
  it("chỉ PENDING quyết được; APPROVED / REJECTED / WITHDRAWN là kết thúc", () => {
    expect(OWNER_CHANGE_REQUEST_TRANSITIONS.APPROVED).toEqual([]);
    expect(OWNER_CHANGE_REQUEST_TRANSITIONS.REJECTED).toEqual([]);
    expect(OWNER_CHANGE_REQUEST_TRANSITIONS.WITHDRAWN).toEqual([]);
    expect(canDecideRequest(request("PENDING"), true)).toBe(true);
    expect(canDecideRequest(request("APPROVED"), true)).toBe(false);
    expect(canDecideRequest(request("PENDING"), false)).toBe(false);
  });
});

describe("Lịch người thay (BR-S07, D7)", () => {
  const cover = (from: string, to: string, extra: Record<string, unknown> = {}) =>
    staffCoverSchema.parse({ id: "v", userId: ME, coverUserId: "u-b", from, to, ...extra });
  const base = { userId: ME, coverUserId: "u-b", from: "2026-12-01", to: "2026-12-10", reason: "" };

  it("trạng thái theo ngày; hết lịch tự hết (không cần làm gì)", () => {
    expect(coverState(cover("2026-12-01", "2026-12-10"), "2026-12-05")).toBe("ACTIVE");
    expect(coverState(cover("2026-12-01", "2026-12-10"), "2026-11-30")).toBe("UPCOMING");
    expect(coverState(cover("2026-12-01", "2026-12-10"), "2026-12-11")).toBe("ENDED");
    expect(coverState(cover("2026-12-01", "2026-12-10", { cancelledAt: "x" }), "2026-12-05")).toBe(
      "CANCELLED",
    );
  });
  it("hợp đồng: status của BE thắng ngày của máy (lệch múi giờ / đồng hồ); status lạ thì suy theo ngày", () => {
    expect(coverState(cover("2026-12-01", "2026-12-10", { status: "ENDED" }), "2026-12-05")).toBe(
      "ENDED",
    );
    expect(coverState(cover("2026-12-01", "2026-12-10", { status: "PAUSED" }), "2026-12-05")).toBe(
      "ACTIVE",
    );
  });
  it("tối đa 60 ngày tính cả hai đầu; ngày 61 bị chặn", () => {
    expect(coverInputSchema.safeParse({ ...base, to: "2027-01-29" }).success).toBe(true);
    const tooLong = coverInputSchema.safeParse({ ...base, to: "2027-01-30" });
    expect(tooLong.error?.issues[0]?.message).toBe("Lịch thay tối đa 60 ngày");
  });
  it("không tự thay mình; đến ngày không trước từ ngày", () => {
    expect(coverInputSchema.safeParse({ ...base, coverUserId: ME }).error?.issues[0]?.message).toBe(
      "Người thay phải là người khác",
    );
    expect(coverInputSchema.safeParse({ ...base, to: "2026-11-30" }).success).toBe(false);
  });
  it("huỷ: Sale chỉ lịch của mình, quản lý mọi lịch; lịch đã hết / đã huỷ thì không", () => {
    const mine = cover("2026-12-01", "2026-12-10");
    const ctx = { userId: ME, canUpdate: true, isManager: false };
    expect(canCancelCover(mine, "ACTIVE", ctx)).toBe(true);
    expect(canCancelCover({ ...mine, userId: "u-x" }, "ACTIVE", ctx)).toBe(false);
    expect(
      canCancelCover({ ...mine, userId: "u-x" }, "UPCOMING", { ...ctx, isManager: true }),
    ).toBe(true);
    expect(canCancelCover(mine, "ENDED", ctx)).toBe(false);
  });
});

describe("Chuyển khách hàng loạt (BR-S09, §10.1)", () => {
  const base = {
    fromUserId: "a",
    toUserIds: ["b"],
    scope: "all" as const,
    customerIds: [],
    reason: "STAFF_LEFT",
    note: "",
    temporary: false,
    notifyCustomer: true,
  };
  const message = (v: Record<string, unknown>) =>
    transferInputSchema.safeParse({ ...base, ...v }).error?.issues.map((i) => i.message);

  it("hợp lệ: một hay nhiều Sale nhận", () => {
    expect(transferInputSchema.safeParse({ ...base, toUserIds: ["b", "c"] }).success).toBe(true);
  });
  it("lý do bắt buộc; người nhận khác người chuyển; chọn một phần thì phải có khách", () => {
    expect(message({ reason: "" })).toContain("Chọn lý do");
    expect(message({ toUserIds: ["a"] })).toContain("Sale nhận phải khác Sale đang phụ trách");
    expect(message({ scope: "picked" })).toContain("Chọn ít nhất một khách");
  });
  it("lý do 'Tạm thời' phải đánh dấu lô tạm để trả lại sau", () => {
    expect(message({ reason: "TEMPORARY_LEAVE" })).toEqual([
      "Lý do “Tạm thời” cần đánh dấu lô tạm để trả lại sau",
    ]);
    expect(
      transferInputSchema.safeParse({ ...base, reason: "TEMPORARY_LEAVE", temporary: true })
        .success,
    ).toBe(true);
  });
});

describe("Bảng tải và gợi ý (§10.4)", () => {
  const w = (id: string, name: string, extra: Record<string, unknown> = {}) =>
    salesWorkloadRowSchema.parse(workloadRow(id, name, extra));
  it("ghép số chat theo userId; Sale không có số chat → null, không bịa 0", () => {
    const merged = mergeWorkload(
      [w("a", "An"), w("b", "Bình")],
      [{ userId: "a", openConversations: 4, overdueConversations: 1 }],
    );
    expect(merged.map((r) => [r.userId, r.openConversations])).toEqual([
      ["a", 4],
      ["b", null],
    ]);
  });
  it("gợi ý Sale ít khách nhất, bỏ người tạm dừng / đang nghỉ / đủ sức chứa", () => {
    const rows = [
      w("a", "An", { customers: 1, paused: true }),
      w("b", "Bình", { customers: 2, onLeave: true }),
      w("c", "Chi", { customers: 3, capacityPerMonth: 2, newCustomersThisMonth: 2 }),
      w("d", "Dũng", { customers: 8 }),
      w("e", "Em", { customers: 5 }),
    ];
    expect(suggestLeastLoaded(rows)?.userId).toBe("e");
    expect(suggestLeastLoaded([])).toBeNull();
  });
});

describe("Chuyển lead thành khách (§10.7) — link form tạo khách", () => {
  it("tham số = tên ô form tạo khách + leadId; ô trống bỏ đi", () => {
    const url = customerCreateFromLead({
      leadId: "l-1",
      companyName: "Công ty X",
      taxCode: "0312345678",
      contactName: "Chị Lan",
      email: "",
      phone: null,
    });
    const query = new URL(url, "http://x").searchParams;
    expect(url.startsWith("/admin/customers/create?")).toBe(true);
    expect(Object.fromEntries(query)).toEqual({
      leadId: "l-1",
      companyName: "Công ty X",
      taxCode: "0312345678",
      contactName: "Chị Lan",
    });
  });
});
