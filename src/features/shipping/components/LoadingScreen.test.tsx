import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SHIPPING_ERROR_MESSAGES,
  SHIPPING_FIELD_MESSAGES,
  STORAGE_KEYS,
  UI_LABELS,
} from "@/constants";
import { ApiError } from "@/lib/api/error";
import { useRejectedScansStore } from "@/features/shipping/rejected-scans-store";

import { LOAD_ID, apiLoad, line } from "../__fixtures__/load";
import {
  SHIPPING_ROLE_PERMISSIONS as ROLES,
  mockShippingApi,
  renderShippingScreen,
} from "../__fixtures__/render";
import { LoadingScreen } from "./LoadingScreen";

import type { PermissionCode } from "@/lib/auth";
import type { Load } from "../types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => {
  vi.restoreAllMocks();
  // Danh sách mã lỗi lưu ngoài component (sessionStorage) → dọn giữa các test
  useRejectedScansStore.setState({ byLoad: {} });
});

const PATH = `/fulfillment/loads/${LOAD_ID}`;
const L = UI_LABELS.shipping;

function renderLoading(
  permissions: readonly PermissionCode[],
  load: Load,
  scan?: (body: unknown) => unknown,
) {
  const spies = mockShippingApi(
    permissions,
    { [PATH]: () => load },
    {
      [`${PATH}/scans`]: (_p, body) => (scan ? scan(body) : load),
      [`${PATH}/loading-start`]: () => ({ ...load, status: "LOADING" }),
    },
  );
  renderShippingScreen(<LoadingScreen id={LOAD_ID} />);
  return spies;
}

describe("LoadingScreen — quét kiện lên xe", () => {
  it("quét đúng kiện → gửi mã in hoa, báo đã lên xe và cập nhật tiến độ", async () => {
    const user = userEvent.setup();
    const full = apiLoad({
      lines: [line(1, "2026-10-12T01:10:00Z"), line(2, "2026-10-12T01:12:00Z")],
    });
    const { post } = renderLoading(ROLES.warehouseStaff, apiLoad(), () => full);

    const input = await screen.findByLabelText(L.scan.label);
    expect(input).toHaveFocus();
    await user.type(input, " pkg-0002{Enter}");

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`${PATH}/scans`, { packageCode: "PKG-0002" }),
    );
    // Vùng live "status" (lịch sự) đọc kết quả quét đúng
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(`PKG-0002 — ${L.scan.accepted} (2/2)`),
    );
    expect(input).toHaveValue("");
  });

  it("quét liên tục 2 mã → gửi lần lượt đúng thứ tự, không rơi mã nào", async () => {
    const user = userEvent.setup();
    const { post } = renderLoading(ROLES.warehouseStaff, apiLoad());
    const input = await screen.findByLabelText(L.scan.label);
    await user.type(input, "PKG-0002{Enter}PKG-0003{Enter}");
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post.mock.calls.map((c) => c[1])).toEqual([
      { packageCode: "PKG-0002" },
      { packageCode: "PKG-0003" },
    ]);
  });

  it("mã bị từ chối rồi mã sau quét đúng → mã bị từ chối vẫn nằm trong danh sách để gỡ khỏi xe", async () => {
    const user = userEvent.setup();
    renderLoading(ROLES.warehouseStaff, apiLoad(), (body) => {
      if ((body as { packageCode: string }).packageCode === "PKG-9") {
        throw new ApiError(409, "PACKAGE_NOT_IN_LOAD", "x");
      }
      return apiLoad();
    });
    const input = await screen.findByLabelText(L.scan.label);
    await user.type(input, "PKG-9{Enter}PKG-0002{Enter}");

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(`PKG-0002 — ${L.scan.accepted}`),
    );
    const list = screen.getByRole("list");
    expect(within(list).getByRole("listitem")).toHaveTextContent(
      `PKG-9— ${SHIPPING_ERROR_MESSAGES.PACKAGE_NOT_IN_LOAD}`,
    );
    await user.click(screen.getByRole("button", { name: L.scan.clearRejected }));
    expect(screen.queryByText(L.scan.rejectedTitle, { exact: false })).not.toBeInTheDocument();
  });

  it("rời màn quét rồi quay lại (sang biên bản, F5) → danh sách kiện phải gỡ vẫn còn", async () => {
    const user = userEvent.setup();
    renderLoading(ROLES.warehouseStaff, apiLoad(), () => {
      throw new ApiError(409, "PACKAGE_NOT_IN_LOAD", "x");
    });
    const input = await screen.findByLabelText(L.scan.label);
    await user.type(input, "PKG-9{Enter}");
    await screen.findByRole("heading", { name: `${L.scan.rejectedTitle} (1)` });
    cleanup();
    // F5: bộ nhớ trong mất, chỉ còn bản lưu sessionStorage → nạp lại từ đó. (setState của persist
    // ghi luôn xuống storage → giữ bản đã lưu, xoá bộ nhớ trong, rồi trả bản lưu lại trước khi nạp)
    const saved = sessionStorage.getItem(STORAGE_KEYS.shipmentRejectedScans) ?? "";
    expect(saved).toContain("PKG-9");
    useRejectedScansStore.setState({ byLoad: {} });
    sessionStorage.setItem(STORAGE_KEYS.shipmentRejectedScans, saved);
    await useRejectedScansStore.persist.rehydrate();

    renderLoading(ROLES.warehouseStaff, apiLoad());
    expect(
      await screen.findByRole("heading", { name: `${L.scan.rejectedTitle} (1)` }),
    ).toBeInTheDocument();
  });

  it("mất mạng giữa loạt quét → dừng hàng đợi, mã chưa gửi vào danh sách để quét lại", async () => {
    const user = userEvent.setup();
    const { post } = renderLoading(ROLES.warehouseStaff, apiLoad());
    // Mã đầu treo tới khi cả hai mã đã vào hàng đợi, rồi mới lỗi mạng
    let fail: (error: unknown) => void = () => undefined;
    post.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          fail = reject;
        }),
    );
    const input = await screen.findByLabelText(L.scan.label);
    await user.type(input, "PKG-0002{Enter}PKG-0003{Enter}");
    fail(new ApiError(0, "NETWORK_ERROR", "offline"));
    await screen.findByRole("heading", { name: `${L.scan.rejectedTitle} (2)` });
    // Chỉ mã đầu được gửi — mã sau không gửi tiếp vào mạng đang mất
    expect(post.mock.calls.filter(([url]) => url === `${PATH}/scans`)).toHaveLength(1);
    expect(screen.getByText(L.scan.notSent, { exact: false })).toBeInTheDocument();
  });

  it("quét lại đúng mã bị từ chối → vẫn một dòng, số đếm không tăng", async () => {
    const user = userEvent.setup();
    const { post } = renderLoading(ROLES.warehouseStaff, apiLoad(), () => {
      throw new ApiError(409, "PACKAGE_NOT_IN_LOAD", "x");
    });
    const input = await screen.findByLabelText(L.scan.label);
    await user.type(input, "PKG-9{Enter}");
    await screen.findByRole("heading", { name: `${L.scan.rejectedTitle} (1)` });
    await user.type(input, "PKG-9{Enter}");
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(
      await screen.findByRole("heading", { name: `${L.scan.rejectedTitle} (1)` }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("PKG-9")).toHaveLength(1);
  });

  it("mã lỗi mạng rồi quét lại thành công → không còn trong danh sách kiện phải gỡ", async () => {
    const user = userEvent.setup();
    let attempt = 0;
    renderLoading(ROLES.warehouseStaff, apiLoad(), () => {
      attempt += 1;
      if (attempt === 1) throw new ApiError(0, "NETWORK_ERROR", "offline");
      return apiLoad({ lines: [line(1, null), line(2, "2026-10-12T01:12:00Z")] });
    });
    const input = await screen.findByLabelText(L.scan.label);
    await user.type(input, "PKG-0002{Enter}");
    await screen.findByText(L.scan.rejectedTitle, { exact: false });

    await user.type(input, "PKG-0002{Enter}");
    await waitFor(() =>
      expect(screen.queryByText(L.scan.rejectedTitle, { exact: false })).not.toBeInTheDocument(),
    );
  });

  it("kiện đã lên xe từ trước (quét đúp) → báo nhẹ, KHÔNG vào danh sách kiện phải gỡ", async () => {
    const user = userEvent.setup();
    renderLoading(ROLES.warehouseStaff, apiLoad(), () => {
      throw new ApiError(409, "PACKAGE_ALREADY_LOADED", "x");
    });
    const input = await screen.findByLabelText(L.scan.label);
    await user.type(input, "PKG-0001{Enter}");
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        SHIPPING_ERROR_MESSAGES.PACKAGE_ALREADY_LOADED,
      ),
    );
    expect(screen.queryByText(L.scan.rejectedTitle, { exact: false })).not.toBeInTheDocument();
  });

  it("mã có dấu (bộ gõ tiếng Việt đang bật) → chặn trước khi gửi, báo cách sửa", async () => {
    const user = userEvent.setup();
    const { post } = renderLoading(ROLES.warehouseStaff, apiLoad());
    const input = await screen.findByLabelText(L.scan.label);
    await user.type(input, "PKG-ĐƯ1{Enter}");
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(SHIPPING_FIELD_MESSAGES.scanNotAscii),
    );
    expect(post).not.toHaveBeenCalledWith(`${PATH}/scans`, expect.anything());
  });

  it("kiện không thuộc chuyến → BE 409 PACKAGE_NOT_IN_LOAD, báo lỗi tiếng Việt", async () => {
    const user = userEvent.setup();
    renderLoading(ROLES.warehouseStaff, apiLoad(), () => {
      throw new ApiError(409, "PACKAGE_NOT_IN_LOAD", "Package PKG-9 is not planned on LOAD-1");
    });
    await user.type(await screen.findByLabelText(L.scan.label), "PKG-9{Enter}");
    // Lỗi quét đọc ngay qua vùng "alert"
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        `PKG-9 — ${SHIPPING_ERROR_MESSAGES.PACKAGE_NOT_IN_LOAD}`,
      ),
    );
  });

  it("VEHICLE_BOOKED → chưa có ô quét; Bắt đầu xếp hàng → chuyến LOADING, mở ô quét", async () => {
    const user = userEvent.setup();
    const { post } = renderLoading(ROLES.warehouseStaff, apiLoad({ status: "VEHICLE_BOOKED" }));
    const start = await screen.findByRole("button", { name: L.action.startLoading });
    expect(screen.queryByLabelText(L.scan.label)).not.toBeInTheDocument();
    expect(screen.getByText(L.scan.notStarted)).toBeInTheDocument();
    await user.click(start);
    await waitFor(() => expect(post).toHaveBeenCalledWith(`${PATH}/loading-start`, undefined));
    expect(await screen.findByLabelText(L.scan.label)).toHaveFocus();
  });

  it("chỉ quyền xem → không có ô quét, không có nút thao tác", async () => {
    renderLoading(ROLES.viewOnly, apiLoad());
    expect(await screen.findByText(L.missingSection + " (1)")).toBeInTheDocument();
    expect(screen.queryByLabelText(L.scan.label)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.action.startLoading })).not.toBeInTheDocument();
    // Biên bản chỉ đọc / in — người có quyền xem vẫn mở được
    expect(screen.getByRole("link", { name: L.action.openManifest })).toBeInTheDocument();
  });

  it("chuyến đã bàn giao (vd ở máy khác) → không có ô quét, nói rõ lý do", async () => {
    renderLoading(ROLES.warehouseStaff, apiLoad({ status: "DISPATCHED" }));
    expect(await screen.findByText(L.noActions.dispatched)).toBeInTheDocument();
    expect(screen.queryByLabelText(L.scan.label)).not.toBeInTheDocument();
  });

  it("không được cấp màn → báo không có quyền", async () => {
    renderLoading(ROLES.noAccess, apiLoad());
    expect(await screen.findByText(UI_LABELS.loadError.forbiddenTitle)).toBeInTheDocument();
  });
});
