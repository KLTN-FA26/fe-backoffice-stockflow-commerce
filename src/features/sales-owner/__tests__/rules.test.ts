import { describe, expect, it } from "vitest";

import { customerCreateFromLead } from "@/constants/sales-owner";

import { salesOwnerHistoryNote } from "@/lib/references/sales-owner";
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
import { skipReasonLabel } from "../errors";
import {
  coverState,
  leadHistoryLine,
  leadInterestsLabel,
  mergeWorkload,
  parseLeadResubmission,
} from "../selectors";
import { leadHistoryEntrySchema } from "../schemas";
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

describe("không hiện tiếng Anh của BE (ghi chú hệ thống, mã lạ)", () => {
  const PREFIX = "The form was sent again: company ";

  it("đọc ghi chú RESUBMITTED đúng dấu phân cách của BE `LeadService.resubmissionNote`", () => {
    expect(
      parseLeadResubmission(
        `${PREFIX}Công ty A; tax code 0312345678-001; contact Chị Lan (Kế toán); phone 0909 000 111; e-mail lan@a.vn; province Hà Nội; interests CUP, BOX; monthly volume 5000; note gọi buổi sáng; phone 1`,
      ),
    ).toEqual({
      company: "Công ty A",
      contact: "Chị Lan (Kế toán)",
      phone: "0909 000 111",
      email: "lan@a.vn",
    });
    // Chỉ công ty + người liên hệ (các phần khác BE bỏ khi trống)
    expect(parseLeadResubmission(`${PREFIX}Quán B; contact Anh Tư`)).toEqual({
      company: "Quán B",
      contact: "Anh Tư",
      phone: null,
      email: null,
    });
  });

  it("không đúng định dạng → null (màn hình chỉ hiện 'Khách gửi lại form')", () => {
    expect(parseLeadResubmission(null)).toBeNull();
    expect(parseLeadResubmission("Customer sent the form twice")).toBeNull();
    expect(parseLeadResubmission(`${PREFIX}Công ty A; phone 0909000111`)).toBeNull();
    expect(parseLeadResubmission(`${PREFIX}Công ty A; contact Lan; phone call me`)).toBeNull();
    expect(parseLeadResubmission(`${PREFIX}Công ty A; contact Lan; e-mail none`)).toBeNull();
  });

  const entry = (row: Record<string, unknown>) =>
    leadHistoryEntrySchema.parse({ changedAt: "2026-11-27T00:00:00Z", ...row });

  it("ghi chú hệ thống đã biết → tiếng Việt; ghi chú người gõ giữ; ghi chú lạ ẩn; RESUBMITTED không hiện nguyên văn", () => {
    expect(
      leadHistoryLine(
        entry({
          fromStatus: "CONTACTED",
          toStatus: "NEW",
          note: "The salesperson's account was locked or disabled: back to the managers' queue",
        }),
      ).note,
    ).toMatch(/^Tài khoản của Sale được giao đã bị khoá/);
    expect(
      leadHistoryLine(entry({ fromStatus: "ASSIGNED", toStatus: "CONTACTED", note: "Đã gọi" }))
        .note,
    ).toBe("Đã gọi");
    expect(
      leadHistoryLine(entry({ fromStatus: "NEW", toStatus: "ASSIGNED", note: "Assigned by rule" }))
        .note,
    ).toBeNull();
    const bad = leadHistoryLine(entry({ kind: "RESUBMITTED", toStatus: "NEW", note: "garbled" }));
    expect(bad).toMatchObject({ title: "Khách gửi lại form", note: null, resubmission: null });
  });

  it("mã lạ: lý do bỏ qua → 'Không rõ lý do'; trạng thái → 'Trạng thái khác'; nhóm hàng lạ bỏ qua", () => {
    expect(skipReasonLabel("OWNER_CHANGED")).toBe(
      "Khách vừa được đổi người phụ trách trong lúc chuyển",
    );
    expect(skipReasonLabel("SOMETHING_NEW")).toBe("Không rõ lý do");
    expect(skipReasonLabel(null)).toBe("Không rõ lý do");
    expect(leadHistoryLine(entry({ fromStatus: "ASSIGNED", toStatus: "PAUSED" })).title).toBe(
      "Đã giao → Trạng thái khác",
    );
    expect(leadInterestsLabel(["CUP", "GADGET"])).toBe("Ly");
    expect(leadInterestsLabel(["GADGET"])).toBe("—");
  });

  it("lịch sử người phụ trách: ghi chú BACKFILL của migration → tiếng Việt; ghi chú người gõ giữ nguyên", () => {
    expect(salesOwnerHistoryNote("From the newest sent quote or contract")).toBe(
      "Theo báo giá hoặc hợp đồng gửi gần nhất",
    );
    expect(salesOwnerHistoryNote("Khách xin đổi")).toBe("Khách xin đổi");
    expect(salesOwnerHistoryNote("  ")).toBeNull();
  });
});
