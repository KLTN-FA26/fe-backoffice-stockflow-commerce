import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PAGE_SIZE,
  SHIPMENT_PERMISSIONS,
  SHIPPING_ERROR_MESSAGES,
  SHIPPING_FIELD_MESSAGES,
  UI_LABELS,
} from "@/constants";
import { ApiError } from "@/lib/api/error";

import {
  SHIPPING_ACTORS as ACTORS,
  CARRIERS,
  bePage,
  mockShippingApi,
  renderShippingScreen,
} from "../__fixtures__/render";
import { CarrierList } from "./CarrierList";

import type { TestActor } from "../__fixtures__/render";

const C = UI_LABELS.shipping.waybill.carriers;
const F = C.form;
const E = UI_LABELS.emptyList;
// Nút của khung hộp thoại dùng chung (`FormDialogBody`), chưa có trong constants
const CANCEL = "Huỷ";
const LIST_URL = "/fulfillment/carriers";
const SECRET = "s3cret-0123456789";

/** Hãng của fixture kèm liên hệ và version khác 0 để thấy `version` được gửi lại đúng. */
const LIST = CARRIERS.map((carrier, index) => ({
  ...carrier,
  contactName: `Liên hệ ${carrier.code}`,
  contactPhone: `090${index}`,
  version: 4 + index,
}));
const [MANUAL, WEBHOOK, API] = LIST;

type Handler = (params: unknown, body?: unknown) => unknown;
type User = ReturnType<typeof userEvent.setup>;

function renderList(
  actor: TestActor,
  options: { search?: string; list?: Handler; post?: Handler; put?: Handler } = {},
) {
  const spies = mockShippingApi(actor, {
    get: { [LIST_URL]: options.list ?? (() => bePage(LIST)) },
    post: { [LIST_URL]: options.post ?? (() => MANUAL) },
    put: {
      [`${LIST_URL}/car-ghn`]: options.put ?? (() => MANUAL),
      [`${LIST_URL}/car-vtp`]: options.put ?? (() => WEBHOOK),
      [`${LIST_URL}/car-ahm`]: options.put ?? (() => API),
    },
  });
  renderShippingScreen(<CarrierList />, options.search);
  return spies;
}

afterEach(() => {
  vi.restoreAllMocks();
});

const listCalls = (get: { mock: { calls: unknown[][] } }) =>
  get.mock.calls.filter(([url]) => url === LIST_URL);
const lastListParams = (get: { mock: { calls: unknown[][] } }) =>
  (listCalls(get).at(-1)?.[1] as { params?: Record<string, unknown> } | undefined)?.params;
/** Thân yêu cầu POST / PUT đã gửi. */
const bodyOf = (spy: { mock: { calls: unknown[][] } }): Record<string, unknown> => {
  const body = spy.mock.calls.at(-1)?.[1];
  if (typeof body !== "object" || body === null) throw new Error("Chưa gửi thân yêu cầu nào");
  return Object.fromEntries(Object.entries(body));
};

const dialogOf = async () => screen.findByRole("dialog");
const field = (dialog: HTMLElement, label: string) =>
  within(dialog).getByLabelText(label, { exact: false });

async function pickConnection(user: User, dialog: HTMLElement, label: string) {
  await user.click(within(dialog).getByRole("combobox", { name: F.connectionType }));
  await user.click(await screen.findByRole("option", { name: label }));
}

describe("CarrierList — danh sách", () => {
  it("hiện mã, tên, liên hệ, kiểu kết nối, trạng thái bằng tiếng Việt; gọi BE trang đầu theo cỡ trang danh mục", async () => {
    const { get } = renderList(ACTORS.warehouseManager);
    await screen.findByText("Giao Hàng Nhanh");
    const table = screen.getByRole("table");
    for (const carrier of LIST) {
      const row = within(table)
        .getAllByRole("row")
        .find((r) => within(r).queryByText(carrier.code));
      if (!row) throw new Error(`Không có dòng ${carrier.code}`);
      expect(within(row).getByText(carrier.name)).toBeInTheDocument();
      expect(
        within(row).getByText(`${carrier.contactName} · ${carrier.contactPhone}`),
      ).toBeInTheDocument();
      expect(within(row).getByText(C.status.ACTIVE)).toBeInTheDocument();
    }
    expect(within(table).getByText(C.connectionType.MANUAL)).toBeInTheDocument();
    expect(within(table).getByText(C.connectionType.WEBHOOK_LOAD)).toBeInTheDocument();
    expect(within(table).getByText(C.connectionType.API_BOOKING)).toBeInTheDocument();
    expect(lastListParams(get)).toEqual({
      page: 0,
      size: PAGE_SIZE.md,
      status: undefined,
      search: undefined,
    });
  });

  it("bộ lọc trên URL: ?q & ?status gửi đúng search / status cho BE; 'Xoá bộ lọc' gỡ cả hai", async () => {
    const user = userEvent.setup();
    const { get } = renderList(ACTORS.warehouseStaff, { search: "?q=ghn&status=INACTIVE" });
    await screen.findByText("Giao Hàng Nhanh");
    await waitFor(() =>
      expect(lastListParams(get)).toMatchObject({ search: "ghn", status: "INACTIVE", page: 0 }),
    );
    expect(screen.getByRole("combobox", { name: C.statusFilter })).toHaveTextContent(
      C.status.INACTIVE,
    );
    await user.click(screen.getByRole("button", { name: C.clearFilters }));
    await waitFor(() =>
      expect(lastListParams(get)).toMatchObject({ search: undefined, status: undefined }),
    );
    expect(screen.queryByRole("button", { name: C.clearFilters })).not.toBeInTheDocument();
  });

  it("gõ vào ô tìm kiếm và chọn trạng thái → gửi search / status mới (về trang đầu)", async () => {
    const user = userEvent.setup();
    const { get } = renderList(ACTORS.warehouseStaff);
    await screen.findByText("Giao Hàng Nhanh");
    await user.type(screen.getByRole("searchbox", { name: C.searchPlaceholder }), "vtp");
    await waitFor(() => expect(lastListParams(get)).toMatchObject({ search: "vtp", page: 0 }));
    await user.click(screen.getByRole("combobox", { name: C.statusFilter }));
    await user.click(await screen.findByRole("option", { name: C.status.ACTIVE }));
    await waitFor(() =>
      expect(lastListParams(get)).toMatchObject({ search: "vtp", status: "ACTIVE" }),
    );
  });

  it("chưa có hãng nào: quản lý kho được mời thêm hãng", async () => {
    renderList(ACTORS.warehouseManager, { list: () => bePage([]) });
    expect(await screen.findByText(C.empty.noDataTitle)).toBeInTheDocument();
    expect(screen.getByText(C.empty.noDataDescription)).toBeInTheDocument();
    expect(screen.queryByText(C.empty.noDataDescriptionReadOnly)).not.toBeInTheDocument();
  });

  it("chưa có hãng nào và người dùng chỉ đọc: câu gợi ý dành cho người chỉ đọc", async () => {
    renderList(ACTORS.warehouseStaff, { list: () => bePage([]) });
    expect(await screen.findByText(C.empty.noDataTitle)).toBeInTheDocument();
    expect(screen.getByText(C.empty.noDataDescriptionReadOnly)).toBeInTheDocument();
    expect(screen.queryByText(C.empty.noDataDescription)).not.toBeInTheDocument();
  });

  it("lọc không ra kết quả khác với chưa có hãng: nêu 'không tìm thấy' và nút bỏ lọc đưa danh sách về đủ", async () => {
    const user = userEvent.setup();
    const { get } = renderList(ACTORS.warehouseManager, {
      search: "?q=zzz",
      list: (params) => ((params as { search?: string }).search ? bePage([]) : bePage(LIST)),
    });
    expect(await screen.findByText(E.noResultsTitle)).toBeInTheDocument();
    expect(screen.getByText(C.empty.noResultsDescription)).toBeInTheDocument();
    expect(screen.queryByText(C.empty.noDataTitle)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: E.clearFilters }));
    expect(await screen.findByText("Giao Hàng Nhanh")).toBeInTheDocument();
    expect(lastListParams(get)?.search).toBeUndefined();
  });
});

describe("CarrierList — thêm hãng", () => {
  it("hãng thường: nút gửi khóa tới khi mã + tên hợp lệ; POST đúng thân yêu cầu (MANUAL, không có version, không có khoá)", async () => {
    const user = userEvent.setup();
    const { post } = renderList(ACTORS.warehouseManager);
    await user.click(await screen.findByRole("button", { name: C.create }));
    const dialog = await dialogOf();
    expect(within(dialog).getByText(F.createTitle)).toBeInTheDocument();
    const submit = within(dialog).getByRole("button", { name: F.create });
    expect(submit).toBeDisabled();
    await user.type(field(dialog, F.code), "ahm-2");
    expect(submit).toBeDisabled();
    await user.type(field(dialog, F.name), "Hãng mới");
    await user.type(field(dialog, F.contactName), "Lan");
    await user.type(field(dialog, F.contactPhone), "0903");
    expect(submit).toBeEnabled();
    await user.click(submit);

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0]?.[0]).toBe(LIST_URL);
    const body = bodyOf(post);
    expect(body).toMatchObject({
      code: "ahm-2",
      name: "Hãng mới",
      contactName: "Lan",
      contactPhone: "0903",
      status: "ACTIVE",
      connection: { connectionType: "MANUAL" },
    });
    expect(body.version).toBeUndefined();
    expect((body.connection as { webhookSecret?: string }).webhookSecret).toBeUndefined();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("mã hãng sai định dạng báo lỗi ở ô mã và không gửi", async () => {
    const user = userEvent.setup();
    const { post } = renderList(ACTORS.warehouseManager);
    await user.click(await screen.findByRole("button", { name: C.create }));
    const dialog = await dialogOf();
    await user.type(field(dialog, F.code), "a");
    await user.type(field(dialog, F.name), "Hãng mới");
    expect(
      await within(dialog).findByText(SHIPPING_FIELD_MESSAGES.carrierCodeInvalid),
    ).toBeVisible();
    expect(within(dialog).getByRole("button", { name: F.create })).toBeDisabled();
    expect(post).not.toHaveBeenCalled();
  });

  it("webhook theo chuyến: ô khoá bí mật hiện ra và bắt buộc; khoá 15 ký tự bị chặn, 16 ký tự được gửi kèm connection", async () => {
    const user = userEvent.setup();
    const { post } = renderList(ACTORS.warehouseManager);
    await user.click(await screen.findByRole("button", { name: C.create }));
    const dialog = await dialogOf();
    expect(
      within(dialog).queryByLabelText(F.webhookSecret, { exact: false }),
    ).not.toBeInTheDocument();
    await user.type(field(dialog, F.code), "wh-1");
    await user.type(field(dialog, F.name), "Hãng webhook");
    await pickConnection(user, dialog, C.connectionType.WEBHOOK_LOAD);
    expect(within(dialog).getByText(F.webhookSecretNew)).toBeInTheDocument();
    const submit = within(dialog).getByRole("button", { name: F.create });
    // Thiếu khoá: chưa gửi được
    expect(submit).toBeDisabled();
    await user.type(field(dialog, F.webhookSecret), "x".repeat(15));
    expect(
      await within(dialog).findByText(SHIPPING_FIELD_MESSAGES.webhookSecretInvalid),
    ).toBeVisible();
    expect(submit).toBeDisabled();
    await user.type(field(dialog, F.webhookSecret), "y");
    await waitFor(() => expect(submit).toBeEnabled());
    expect(
      within(dialog).queryByText(SHIPPING_FIELD_MESSAGES.webhookSecretInvalid),
    ).not.toBeInTheDocument();
    await user.click(submit);
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(bodyOf(post).connection).toEqual({
      connectionType: "WEBHOOK_LOAD",
      webhookSecret: `${"x".repeat(15)}y`,
    });
  });

  it("chỉ chọn webhook rồi đổi lại 'Không có webhook' thì khoá không đi kèm", async () => {
    const user = userEvent.setup();
    const { post } = renderList(ACTORS.warehouseManager);
    await user.click(await screen.findByRole("button", { name: C.create }));
    const dialog = await dialogOf();
    await user.type(field(dialog, F.code), "wh-2");
    await user.type(field(dialog, F.name), "Hãng đổi ý");
    await pickConnection(user, dialog, C.connectionType.WEBHOOK_LOAD);
    await user.type(field(dialog, F.webhookSecret), SECRET);
    await pickConnection(user, dialog, C.connectionType.MANUAL);
    await user.click(within(dialog).getByRole("button", { name: F.create }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(bodyOf(post).connection).toMatchObject({ connectionType: "MANUAL" });
    expect((bodyOf(post).connection as { webhookSecret?: string }).webhookSecret).toBeUndefined();
  });

  it("409 CARRIER_CODE_EXISTS hiện ngay trong hộp thoại (hộp thoại giữ nguyên, nội dung đã nhập còn đó); gõ lại thì lỗi mất", async () => {
    const user = userEvent.setup();
    const { post } = renderList(ACTORS.warehouseManager, {
      post: () => {
        throw new ApiError(409, "CARRIER_CODE_EXISTS", "en");
      },
    });
    await user.click(await screen.findByRole("button", { name: C.create }));
    const dialog = await dialogOf();
    await user.type(field(dialog, F.code), "ghn");
    await user.type(field(dialog, F.name), "Trùng mã");
    await user.click(within(dialog).getByRole("button", { name: F.create }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      SHIPPING_ERROR_MESSAGES.CARRIER_CODE_EXISTS,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(field(dialog, F.code)).toHaveValue("ghn");
    await user.type(field(dialog, F.code), "2");
    await waitFor(() =>
      expect(
        within(dialog).queryByText(SHIPPING_ERROR_MESSAGES.CARRIER_CODE_EXISTS),
      ).not.toBeInTheDocument(),
    );
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("lỗi từng ô của BE (400 kèm fieldErrors) hiện dưới đúng ô", async () => {
    const user = userEvent.setup();
    renderList(ACTORS.warehouseManager, {
      post: () => {
        throw new ApiError(400, "VALIDATION_FAILED", "en", { name: "Tên hãng quá dài theo BE" });
      },
    });
    await user.click(await screen.findByRole("button", { name: C.create }));
    const dialog = await dialogOf();
    await user.type(field(dialog, F.code), "bad-1");
    await user.type(field(dialog, F.name), "Tên");
    await user.click(within(dialog).getByRole("button", { name: F.create }));
    expect(await within(dialog).findByText("Tên hãng quá dài theo BE")).toBeVisible();
    expect(field(dialog, F.name)).toHaveAttribute("aria-invalid", "true");
  });

  it("'Huỷ' đóng hộp thoại không gửi gì", async () => {
    const user = userEvent.setup();
    const { post } = renderList(ACTORS.warehouseManager);
    await user.click(await screen.findByRole("button", { name: C.create }));
    const dialog = await dialogOf();
    await user.type(field(dialog, F.code), "tmp");
    await user.click(within(dialog).getByRole("button", { name: CANCEL }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(post).not.toHaveBeenCalled();
  });
});

describe("CarrierList — sửa hãng", () => {
  const openEdit = async (user: User, code: string) => {
    await user.click(await screen.findByRole("button", { name: C.editAria(code) }));
    return dialogOf();
  };

  it("hãng thường: form điền sẵn; PUT gửi version đã đọc và connection hiện tại; đổi tên + ngừng dùng", async () => {
    const user = userEvent.setup();
    const { put } = renderList(ACTORS.warehouseManager);
    const dialog = await openEdit(user, "GHN");
    expect(within(dialog).getByText(F.editTitle)).toBeInTheDocument();
    expect(field(dialog, F.code)).toHaveValue("GHN");
    expect(field(dialog, F.name)).toHaveValue("Giao Hàng Nhanh");
    expect(field(dialog, F.contactName)).toHaveValue("Liên hệ GHN");
    await user.clear(field(dialog, F.name));
    await user.type(field(dialog, F.name), "GHN Express");
    await user.click(within(dialog).getByRole("combobox", { name: F.status }));
    await user.click(await screen.findByRole("option", { name: C.status.INACTIVE }));
    await user.click(within(dialog).getByRole("button", { name: F.save }));
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put.mock.calls[0]?.[0]).toBe(`${LIST_URL}/car-ghn`);
    expect(bodyOf(put)).toMatchObject({
      code: "GHN",
      name: "GHN Express",
      status: "INACTIVE",
      version: MANUAL?.version,
      connection: { connectionType: "MANUAL" },
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("hãng API đặt xe: kiểu kết nối bị khoá (chỉ có câu giải thích), PUT KHÔNG có `connection`", async () => {
    const user = userEvent.setup();
    const { put } = renderList(ACTORS.warehouseManager);
    const dialog = await openEdit(user, "AHAMOVE");
    expect(within(dialog).getByText(F.apiBookingLocked)).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("combobox", { name: F.connectionType }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByLabelText(F.webhookSecret, { exact: false }),
    ).not.toBeInTheDocument();
    await user.clear(field(dialog, F.name));
    await user.type(field(dialog, F.name), "Ahamove (đổi tên)");
    await user.click(within(dialog).getByRole("button", { name: F.save }));
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put.mock.calls[0]?.[0]).toBe(`${LIST_URL}/car-ahm`);
    const body = bodyOf(put);
    expect(body).toMatchObject({ name: "Ahamove (đổi tên)", version: API?.version });
    expect(Object.keys(body)).not.toContain("connection");
  });

  it("hãng webhook đã lưu khoá: khoá để trống = giữ (không gửi khoá), nhập khoá ngắn bị chặn, nhập khoá mới thì gửi", async () => {
    const user = userEvent.setup();
    const { put } = renderList(ACTORS.warehouseManager);
    const dialog = await openEdit(user, "VTP");
    expect(within(dialog).getByText(F.webhookSecretSaved)).toBeInTheDocument();
    expect(within(dialog).queryByText(F.webhookSecretNew)).not.toBeInTheDocument();
    const save = within(dialog).getByRole("button", { name: F.save });
    expect(save).toBeEnabled();
    await user.type(field(dialog, F.webhookSecret), "ngan");
    expect(
      await within(dialog).findByText(SHIPPING_FIELD_MESSAGES.webhookSecretInvalid),
    ).toBeVisible();
    expect(save).toBeDisabled();
    await user.clear(field(dialog, F.webhookSecret));
    await waitFor(() => expect(save).toBeEnabled());
    await user.click(save);
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(bodyOf(put)).toMatchObject({
      version: WEBHOOK?.version,
      connection: { connectionType: "WEBHOOK_LOAD" },
    });
    expect((bodyOf(put).connection as { webhookSecret?: string }).webhookSecret).toBeUndefined();
  });

  it("hãng webhook đổi khoá: khoá mới đi kèm connection", async () => {
    const user = userEvent.setup();
    const { put } = renderList(ACTORS.warehouseManager);
    const dialog = await openEdit(user, "VTP");
    await user.type(field(dialog, F.webhookSecret), SECRET);
    await user.click(within(dialog).getByRole("button", { name: F.save }));
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(bodyOf(put).connection).toEqual({
      connectionType: "WEBHOOK_LOAD",
      webhookSecret: SECRET,
    });
  });

  it("hãng thường chuyển sang webhook: chưa có khoá đã lưu nên khoá là bắt buộc", async () => {
    const user = userEvent.setup();
    const { put } = renderList(ACTORS.warehouseManager);
    const dialog = await openEdit(user, "GHN");
    await pickConnection(user, dialog, C.connectionType.WEBHOOK_LOAD);
    const save = within(dialog).getByRole("button", { name: F.save });
    expect(within(dialog).getByText(F.webhookSecretNew)).toBeInTheDocument();
    await waitFor(() => expect(save).toBeDisabled());
    await user.type(field(dialog, F.webhookSecret), SECRET);
    await waitFor(() => expect(save).toBeEnabled());
    await user.click(save);
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(bodyOf(put).connection).toEqual({
      connectionType: "WEBHOOK_LOAD",
      webhookSecret: SECRET,
    });
  });

  it("409 OPTIMISTIC_LOCK (hãng đã đổi ở nơi khác) hiện inline, tải lại danh mục để lần gửi sau dùng version mới", async () => {
    const user = userEvent.setup();
    const { get } = renderList(ACTORS.warehouseManager, {
      put: () => {
        throw new ApiError(409, "OPTIMISTIC_LOCK", "en");
      },
    });
    const dialog = await openEdit(user, "GHN");
    const before = listCalls(get).length;
    await user.type(field(dialog, F.contactName), "!");
    await user.click(within(dialog).getByRole("button", { name: F.save }));
    // Câu riêng cho hãng, không phải câu "Chuyến vừa được cập nhật" của màn chuyến
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(C.form.stale);
    await waitFor(() => expect(listCalls(get).length).toBeGreaterThan(before));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("409 CARRIER_CODE_EXISTS khi đổi mã sang mã của hãng khác hiện inline", async () => {
    const user = userEvent.setup();
    renderList(ACTORS.warehouseManager, {
      put: () => {
        throw new ApiError(409, "CARRIER_CODE_EXISTS", "en");
      },
    });
    const dialog = await openEdit(user, "GHN");
    await user.clear(field(dialog, F.code));
    await user.type(field(dialog, F.code), "VTP");
    await user.click(within(dialog).getByRole("button", { name: F.save }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      SHIPPING_ERROR_MESSAGES.CARRIER_CODE_EXISTS,
    );
  });
});

describe("CarrierList — quyền", () => {
  it("quản lý kho (fulfillment-carriers:UPDATE) thấy 'Thêm hãng' và nút sửa trên từng dòng", async () => {
    renderList(ACTORS.warehouseManager);
    expect(await screen.findByRole("button", { name: C.create })).toBeInTheDocument();
    for (const carrier of LIST) {
      expect(
        await screen.findByRole("button", { name: C.editAria(carrier.code) }),
      ).toBeInTheDocument();
    }
  });

  it.each([
    ["nhân viên kho", ACTORS.warehouseStaff],
    ["điều phối đơn", ACTORS.orderCoordinator],
    ["người chỉ xem", ACTORS.viewOnly],
  ])(
    "%s xem được danh sách nhưng không có 'Thêm hãng' lẫn nút sửa, không gọi POST / PUT",
    async (_name, actor) => {
      const { post, put } = renderList(actor);
      await screen.findByText("Giao Hàng Nhanh");
      expect(screen.queryByRole("button", { name: C.create })).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: new RegExp(F.editTitle) }),
      ).not.toBeInTheDocument();
      for (const carrier of LIST) {
        expect(
          screen.queryByRole("button", { name: C.editAria(carrier.code) }),
        ).not.toBeInTheDocument();
      }
      expect(
        screen.queryByRole("columnheader", { name: C.column.actions }),
      ).not.toBeInTheDocument();
      expect(post).not.toHaveBeenCalled();
      expect(put).not.toHaveBeenCalled();
    },
  );

  it("không có quyền xem trang giao hàng → màn bị chặn, không gọi danh sách hãng", async () => {
    const { get } = renderList(ACTORS.noAccess);
    expect(await screen.findByText(UI_LABELS.loadError.forbiddenTitle)).toBeInTheDocument();
    expect(screen.queryByText("Giao Hàng Nhanh")).not.toBeInTheDocument();
    expect(listCalls(get)).toHaveLength(0);
  });

  it("có quyền xem trang nhưng thiếu fulfillment-shipments:READ → báo không có quyền xem dữ liệu, không có thanh công cụ, không gọi BE", async () => {
    const { get } = renderList({ permissions: [SHIPMENT_PERMISSIONS.viewPage] });
    expect(await screen.findByText(UI_LABELS.loadError.noReadTitle)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: C.create })).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(listCalls(get)).toHaveLength(0);
  });
});
