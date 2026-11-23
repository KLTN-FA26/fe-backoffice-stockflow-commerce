import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PUTAWAY_DETAIL_LABELS, PUTAWAY_ERROR_MESSAGES } from "@/constants";
import { PERMISSION_UI } from "@/constants/permissions";
import { WorkspaceWarehouseProvider } from "@/lib/workspace";
import { apiError, mockApi, renderScreen } from "@/test/api-screen";

import { PutawayTaskDetail } from "../components/detail/PutawayTaskDetail";
import { task } from "./fixtures";

import type { TestRole } from "@/test/api-screen";
import type { PutawayTask } from "../types";

const replace = vi.fn();
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ replace, push: vi.fn(), prefetch: vi.fn() }),
}));

const L = PUTAWAY_DETAIL_LABELS;
const SUGGESTED = task({
  suggestions: [
    { locationCode: "HCM-A01-1-A", reason: "SAME_LOT", freeVolumeM3: 8.304, freeWeightKg: 240 },
    { locationCode: "HCM-A01-1-B", reason: "EMPTY", freeVolumeM3: null, freeWeightKg: null },
  ],
});

function setup(
  role: TestRole,
  data: PutawayTask = SUGGESTED,
  confirm?: (body: unknown) => unknown,
) {
  const spies = mockApi(role, {
    get: { "/putaway-tasks/t-1": () => data },
    post: {
      "/putaway-tasks/t-1/confirmations": (_params, body) =>
        confirm
          ? confirm(body)
          : { ...data, status: "DONE", left: 0, targetLocationCode: "HCM-A01-1-A" },
    },
  });
  renderScreen(
    <WorkspaceWarehouseProvider value={{ id: "wh-1", prefix: "HCM", name: "Kho Hồ Chí Minh" }}>
      <PutawayTaskDetail taskId="t-1" />
    </WorkspaceWarehouseProvider>,
    role,
  );
  return spies;
}

const submitButton = () => screen.queryByRole("button", { name: L.submit });

afterEach(() => {
  vi.restoreAllMocks();
  replace.mockReset();
});

describe("PutawayTaskDetail — action-gating (≥ 3 vai trò)", () => {
  it("Nhân viên kho + Pending → thẻ xác nhận, con trỏ ở ô LPN", async () => {
    setup("WAREHOUSE_STAFF");
    expect(await screen.findByRole("button", { name: L.submit })).toBeInTheDocument();
    expect(screen.getByLabelText(L.lpnField)).toHaveFocus();
  });

  it("Quản lý kho + Pending → cũng cất được", async () => {
    setup("WAREHOUSE_MANAGER");
    expect(await screen.findByRole("button", { name: L.submit })).toBeInTheDocument();
  });

  it("vai trò không có quyền cất hàng → báo không có quyền, không thẻ xác nhận", async () => {
    setup("QC_STAFF");
    expect(await screen.findByText(PERMISSION_UI.deniedTitle)).toBeInTheDocument();
    expect(submitButton()).not.toBeInTheDocument();
  });

  it("Done → không render nút ghi nào, nêu bin đã cất (BR-06)", async () => {
    setup("WAREHOUSE_STAFF", task({ status: "DONE", left: 0, targetLocationCode: "HCM-B01-1-A" }));
    expect(await screen.findByText(L.doneTitle)).toBeInTheDocument();
    expect(screen.getAllByText("HCM-B01-1-A").length).toBeGreaterThan(0);
    expect(submitButton()).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Chọn bin/ })).not.toBeInTheDocument();
  });
});

describe("PutawayTaskDetail — bin gợi ý + xác nhận (docs 05 §4.3–4.4)", () => {
  it("gợi ý hiện lý do + chỗ trống, null = không giới hạn; không có điểm số", async () => {
    setup("WAREHOUSE_STAFF");
    expect(await screen.findByText(L.reason.SAME_LOT)).toBeInTheDocument();
    expect(screen.getByText("8,304 m³")).toBeInTheDocument();
    expect(screen.getByText("240 kg")).toBeInTheDocument();
    expect(screen.getAllByText(L.unlimited)).toHaveLength(2);
  });

  it("Chọn bin → điền ô bin; quét LPN, Enter sang ô bin, Enter gửi {lpn, locationCode} (không lý do — BR-07)", async () => {
    const user = userEvent.setup();
    const { post } = setup("WAREHOUSE_STAFF");
    await user.click(await screen.findByRole("button", { name: L.chooseBin("HCM-A01-1-B") }));
    expect(screen.getByLabelText(L.locationField)).toHaveValue("HCM-A01-1-B");
    await user.type(screen.getByLabelText(L.lpnField), "LPN-20260923-000001{Enter}");
    expect(screen.getByLabelText(L.locationField)).toHaveFocus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0]?.[1]).toEqual({
      lpn: "LPN-20260923-000001",
      locationCode: "HCM-A01-1-B",
    });
  });

  it("thiếu LPN / bin → lỗi tại ô, không gọi API", async () => {
    const user = userEvent.setup();
    const { post } = setup("WAREHOUSE_STAFF");
    await user.click(await screen.findByRole("button", { name: L.submit }));
    expect(await screen.findByText("Quét LPN của thùng")).toBeInTheDocument();
    expect(screen.getByText("Quét mã bin")).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("BE báo sai thùng → lỗi dưới ô LPN, nêu đúng LPN của nhiệm vụ", async () => {
    const user = userEvent.setup();
    setup("WAREHOUSE_STAFF", SUGGESTED, () => {
      throw apiError(409, "PUTAWAY_LPN_MISMATCH");
    });
    await user.type(await screen.findByLabelText(L.lpnField), "LPN-OTHER");
    await user.type(screen.getByLabelText(L.locationField), "HCM-A01-1-A{Enter}");
    expect(
      await screen.findByText(PUTAWAY_ERROR_MESSAGES.PUTAWAY_LPN_MISMATCH("LPN-20260923-000001")),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(L.lpnField)).toHaveFocus();
  });

  it("BR-13: OVERFLOW bị từ chối → nút dùng bin BE đề nghị", async () => {
    const user = userEvent.setup();
    setup("WAREHOUSE_STAFF", SUGGESTED, () => {
      throw apiError(409, "PUTAWAY_OVERFLOW_NOT_ALLOWED", undefined, "x", {
        locationCode: "HCM-A02-1-A",
      });
    });
    await user.type(await screen.findByLabelText(L.lpnField), "LPN-20260923-000001");
    await user.type(screen.getByLabelText(L.locationField), "HCM-OVF01{Enter}");
    await user.click(await screen.findByRole("button", { name: L.takeAlternative("HCM-A02-1-A") }));
    expect(screen.getByLabelText(L.locationField)).toHaveValue("HCM-A02-1-A");
  });

  it("không bin nào nhận → cảnh báo + khu OVERFLOW chọn được", async () => {
    const user = userEvent.setup();
    setup("WAREHOUSE_STAFF", task({ overflowLocationCodes: ["HCM-OVF01"] }));
    expect(await screen.findByText(L.noSuggestion)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: L.chooseBin("HCM-OVF01") }));
    expect(screen.getByLabelText(L.locationField)).toHaveValue("HCM-OVF01");
  });
});

describe("PutawayTaskDetail — kho của nhiệm vụ khác kho của tab (spec 2026-11-22 §2)", () => {
  const BD_WAREHOUSES = {
    items: [{ id: "wh-bd", prefix: "BD", name: "Kho Bình Dương", status: "ACTIVE" }],
    page: 0,
    size: 200,
    totalElements: 1,
    totalPages: 1,
    hasNext: false,
    hasPrevious: false,
  };

  it("nhiệm vụ của kho BD mở dưới tab HCM → không hiện thẻ cất, chuyển sang tab BD", async () => {
    mockApi("WAREHOUSE_STAFF", {
      get: {
        "/putaway-tasks/t-1": () => ({ ...SUGGESTED, warehouseId: "wh-bd" }),
        "/warehouses": () => BD_WAREHOUSES,
      },
    });
    renderScreen(
      <WorkspaceWarehouseProvider value={{ id: "wh-1", prefix: "HCM", name: "Kho Hồ Chí Minh" }}>
        <PutawayTaskDetail taskId="t-1" />
      </WorkspaceWarehouseProvider>,
      "WAREHOUSE_STAFF",
    );
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/admin/warehouse-map/BD/putaway/t-1"),
    );
    expect(submitButton()).not.toBeInTheDocument();
  });

  it("nhiệm vụ cùng kho với tab → cất bình thường, không chuyển trang", async () => {
    setup("WAREHOUSE_STAFF", { ...SUGGESTED, warehouseId: "wh-1" });
    expect(await screen.findByRole("button", { name: L.submit })).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
