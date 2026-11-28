import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CARRIER_EVENT_NOTE_MAX,
  CARRIER_EVENT_PAGE_SIZE,
  FULFILLMENT_CARRIER_EVENT_PERMISSIONS,
  SHIPMENT_PERMISSIONS,
  SHIPPING_EVENT_ERROR_MESSAGES,
  UI_LABELS,
} from "@/constants";
import { ApiError } from "@/lib/api/error";

import { bePage, mockShippingApi, renderShippingScreen } from "../__fixtures__/render";
import { CarrierEventList } from "./CarrierEventList";

import type { TestActor } from "../__fixtures__/render";

const E = UI_LABELS.shipping.carrierEvents;
const EMPTY = UI_LABELS.emptyList;
const LIST_URL = "/fulfillment/carrier-events";
const READ = FULFILLMENT_CARRIER_EVENT_PERMISSIONS.read;
const UPDATE = FULFILLMENT_CARRIER_EVENT_PERMISSIONS.update;

const ACTORS = {
  manager: {
    permissions: [SHIPMENT_PERMISSIONS.viewPage, SHIPMENT_PERMISSIONS.read, READ, UPDATE],
  },
  viewer: { permissions: [READ] },
  noAccess: { permissions: [SHIPMENT_PERMISSIONS.viewPage] },
} satisfies Record<string, TestActor>;

const BASE = {
  carrierId: "car-nb",
  carrierCode: "XT-NAMBAC",
  source: "WEBHOOK",
  receivedAt: "2026-11-18T06:58:56.540782Z",
  signatureValid: true,
  decidedAt: "2026-11-18T06:58:56.540782Z",
};
const UNMATCHED = {
  ...BASE,
  eventId: "ev-1",
  kind: "DELIVERED",
  carrierReference: "LD-99",
  result: "UNMATCHED",
  resultNote: "No load LD-99",
};
const REVIEW = {
  ...BASE,
  eventId: "ev-2",
  kind: "DELIVERY_FAILED",
  loadId: "ld-1",
  loadCode: "LD-20261117-0001",
  shipmentId: "sh-1",
  shipmentCode: "SO-1-S1",
  result: "NEEDS_REVIEW",
  resultNote: "Shipment SO-1-S1 did not leave on load",
};
const SIGNATURE = {
  ...BASE,
  eventId: "ev-3",
  signatureValid: false,
  result: "INVALID_SIGNATURE",
  resultNote: "Bad signature",
  resolvedAt: "2026-11-18T08:00:00Z",
  resolvedByName: "Trần Minh Khoa",
  resolutionNote: "Đã hỏi hãng, gửi nhầm",
};
const APPLIED = { ...BASE, eventId: "ev-4", kind: "PICKED_UP", result: "APPLIED" };
const ALL = [UNMATCHED, REVIEW, SIGNATURE, APPLIED];
const PAYLOAD = '{"loadCode":"LD-99","type":"DELIVERED"}';

type Handler = (params: unknown, body?: unknown) => unknown;

function renderList(
  actor: TestActor,
  options: { search?: string; list?: Handler; post?: Handler } = {},
) {
  const spies = mockShippingApi(actor, {
    get: {
      [LIST_URL]: options.list ?? (() => bePage(ALL, 0, CARRIER_EVENT_PAGE_SIZE)),
      ...Object.fromEntries(
        ALL.map((event) => [`${LIST_URL}/${event.eventId}`, () => ({ event, payload: PAYLOAD })]),
      ),
    },
    post: {
      [`${LIST_URL}/ev-1/resolution`]:
        options.post ?? (() => ({ event: { ...UNMATCHED, resolvedAt: "2026-11-18T09:00:00Z" } })),
    },
  });
  renderShippingScreen(<CarrierEventList />, options.search);
  return spies;
}

type Spy = { mock: { calls: unknown[][] } };
const listCalls = (get: Spy) => get.mock.calls.filter(([url]) => url === LIST_URL);
const lastParams = (get: Spy) =>
  (listCalls(get).at(-1)?.[1] as { params?: Record<string, unknown> } | undefined)?.params;
const openRow = async (user: ReturnType<typeof userEvent.setup>, index: number) => {
  const buttons = await screen.findAllByRole("button", { name: new RegExp(E.openRow) });
  const button = buttons[index];
  if (!button) throw new Error(`Không có dòng ${index}`);
  // Nút "⋯" cuối dòng mở menu, mục "Xem chi tiết" mở hộp thoại sự kiện
  await user.click(button);
  await user.click(await screen.findByRole("button", { name: "Xem chi tiết" }));
  return screen.findByRole("dialog");
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CarrierEventList — danh sách", () => {
  it("mặc định là danh sách lỗi: gửi result=ERRORS, không lọc đã / chưa xử lý, 20 dòng một trang", async () => {
    const { get } = renderList(ACTORS.manager);
    await screen.findByText(E.result.UNMATCHED);
    expect(lastParams(get)).toEqual({
      result: "ERRORS",
      open: undefined,
      carrierId: undefined,
      loadId: undefined,
      page: 0,
      size: CARRIER_EVENT_PAGE_SIZE,
    });
    expect(screen.getByRole("combobox", { name: E.filter.result })).toHaveTextContent(
      E.filter.errors,
    );
  });

  it("hiện nhãn tiếng Việt, không lộ mã enum; mã chuyến / lô giao là liên kết; ghi chú tiếng Anh của BE bị ẩn", async () => {
    renderList(ACTORS.manager);
    const table = await screen.findByRole("table");
    expect(within(table).getByText(E.result.UNMATCHED)).toBeInTheDocument();
    expect(within(table).getByText(E.result.NEEDS_REVIEW)).toBeInTheDocument();
    expect(within(table).getByText(E.result.INVALID_SIGNATURE)).toBeInTheDocument();
    expect(within(table).getByText(E.result.APPLIED)).toBeInTheDocument();
    expect(within(table).getByText(E.kind.DELIVERY_FAILED)).toBeInTheDocument();
    expect(within(table).getByText(E.kind.PICKED_UP)).toBeInTheDocument();
    expect(within(table).getAllByText(E.source.WEBHOOK).length).toBeGreaterThan(0);
    for (const raw of ["INVALID_SIGNATURE", "NEEDS_REVIEW", "DELIVERY_FAILED", "WEBHOOK"]) {
      expect(table.textContent).not.toContain(raw);
    }
    expect(within(table).getByRole("link", { name: "LD-20261117-0001" })).toHaveAttribute(
      "href",
      "/admin/loads/ld-1",
    );
    expect(within(table).getByRole("link", { name: "SO-1-S1" })).toHaveAttribute(
      "href",
      "/admin/shipments/sh-1",
    );
    // Ghi chú tiếng Anh của BE không hiện ra
    expect(table.textContent).not.toContain("No load");
  });

  it("cột Xử lý: chưa xử lý (lỗi còn mở), người + giờ (đã xử lý), trống (không phải lỗi)", async () => {
    renderList(ACTORS.manager);
    const table = await screen.findByRole("table");
    expect(within(table).getAllByText(E.filter.handlingOpen)).toHaveLength(2);
    expect(within(table).getByText("Trần Minh Khoa")).toBeInTheDocument();
  });

  it("người chỉ có quyền xem sự kiện: mã chuyến / lô giao là chữ thường, không liên kết; ô lọc hãng ẩn", async () => {
    renderList(ACTORS.viewer);
    const table = await screen.findByRole("table");
    expect(within(table).getByText("LD-20261117-0001")).toBeInTheDocument();
    expect(within(table).queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: E.filter.carrier })).not.toBeInTheDocument();
  });

  it("lọc chưa xử lý gửi open=true; chọn 'Tất cả sự kiện' bỏ result, khoá ô xử lý và bỏ open", async () => {
    const user = userEvent.setup();
    const { get } = renderList(ACTORS.manager);
    await screen.findByText(E.result.UNMATCHED);
    await user.click(screen.getByRole("combobox", { name: E.filter.handling }));
    await user.click(await screen.findByRole("option", { name: E.filter.handlingOpen }));
    await waitFor(() => expect(lastParams(get)).toMatchObject({ result: "ERRORS", open: true }));

    await user.click(screen.getByRole("combobox", { name: E.filter.result }));
    await user.click(await screen.findByRole("option", { name: E.filter.all }));
    await waitFor(() => expect(lastParams(get)?.result).toBeUndefined());
    expect(lastParams(get)?.open).toBeUndefined();
    expect(screen.getByRole("combobox", { name: E.filter.handling })).toBeDisabled();
  });

  it("chọn một kết quả cụ thể gửi đúng mã BE", async () => {
    const user = userEvent.setup();
    const { get } = renderList(ACTORS.manager);
    await screen.findByText(E.result.UNMATCHED);
    await user.click(screen.getByRole("combobox", { name: E.filter.result }));
    await user.click(await screen.findByRole("option", { name: E.result.STALE }));
    await waitFor(() => expect(lastParams(get)).toMatchObject({ result: "STALE" }));
    expect(screen.getByRole("combobox", { name: E.filter.handling })).toBeDisabled();
  });

  it("bộ lọc nằm trên URL: ?result, ?handling, ?carrier, ?load gửi đúng cho BE", async () => {
    const { get } = renderList(ACTORS.manager, {
      search: "?result=NEEDS_REVIEW&handling=done&carrier=car-ghn&load=ld-1",
    });
    await screen.findByText(E.result.UNMATCHED);
    expect(lastParams(get)).toMatchObject({
      result: "NEEDS_REVIEW",
      open: false,
      carrierId: "car-ghn",
      loadId: "ld-1",
    });
    expect(screen.getByText(`${E.filter.load}: ${E.filter.loadValue}`)).toBeInTheDocument();
  });

  it("số trang nằm trên URL (?page=2 → page=1 của BE); trang vượt quá dữ liệu hiện nút về trang đầu", async () => {
    const user = userEvent.setup();
    const { get } = renderList(ACTORS.manager, {
      search: "?page=9",
      list: (params) =>
        (params as { page: number }).page === 0
          ? bePage(ALL)
          : { ...bePage([], 8), totalElements: 5, totalPages: 1 },
    });
    expect(await screen.findByText(EMPTY.invalidPageTitle)).toBeInTheDocument();
    expect(lastParams(get)).toMatchObject({ page: 8 });
    await user.click(screen.getByRole("button", { name: EMPTY.firstPage }));
    expect(await screen.findByText(E.result.UNMATCHED)).toBeInTheDocument();
    expect(lastParams(get)).toMatchObject({ page: 0 });
  });

  it("mở từ một chuyến (?load=) mặc định xem mọi sự kiện, không phải danh sách lỗi; bỏ lọc chuyến giữ 'Tất cả'", async () => {
    const user = userEvent.setup();
    const { get } = renderList(ACTORS.manager, { search: "?load=ld-1" });
    await screen.findByText(E.result.APPLIED);
    expect(lastParams(get)).toMatchObject({ result: undefined, loadId: "ld-1" });
    expect(screen.getByRole("combobox", { name: E.filter.result })).toHaveTextContent(E.filter.all);
    await user.click(screen.getByRole("button", { name: E.filter.clearLoad }));
    await waitFor(() => expect(lastParams(get)?.loadId).toBeUndefined());
    expect(lastParams(get)?.result).toBeUndefined();
    expect(screen.getByRole("combobox", { name: E.filter.result })).toHaveTextContent(E.filter.all);
  });

  it("?load= kèm ?result=ERRORS vẫn tôn trọng kết quả được chọn", async () => {
    const { get } = renderList(ACTORS.manager, { search: "?load=ld-1&result=ERRORS" });
    await screen.findByText(E.result.UNMATCHED);
    expect(lastParams(get)).toMatchObject({ result: "ERRORS", loadId: "ld-1" });
  });

  it("thanh Cấu hình: mỗi bộ lọc đang bật có nút X gỡ riêng; hết lọc thì thanh biến mất", async () => {
    const user = userEvent.setup();
    const { get } = renderList(ACTORS.manager, { search: "?handling=open&carrier=car-vtp" });
    await screen.findByText(E.result.UNMATCHED);
    expect(screen.getByText(`${E.filter.handling}: ${E.filter.handlingOpen}`)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: E.filter.clearHandling }));
    await waitFor(() =>
      expect(lastParams(get)).toMatchObject({ open: undefined, carrierId: "car-vtp" }),
    );
    await user.click(screen.getByRole("button", { name: E.filter.clearCarrier }));
    await waitFor(() => expect(lastParams(get)?.carrierId).toBeUndefined());
    // Hết bộ lọc → thanh Cấu hình biến mất (không còn nút Đặt lại khoá)
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: E.filter.resetAll })).not.toBeInTheDocument(),
    );
  });

  it("?size không nằm trong 10 / 15 / 20 / 50 thì dùng cỡ trang mặc định", async () => {
    const { get } = renderList(ACTORS.manager, { search: "?size=7&page=3" });
    await waitFor(() =>
      expect(lastParams(get)).toMatchObject({ size: CARRIER_EVENT_PAGE_SIZE, page: 2 }),
    );
  });

  it("'Xoá bộ lọc' trả về danh sách lỗi mặc định", async () => {
    const user = userEvent.setup();
    const { get } = renderList(ACTORS.manager, { search: "?result=ALL&load=ld-1" });
    await screen.findByText(E.result.UNMATCHED);
    await user.click(screen.getByRole("button", { name: E.filter.resetAll }));
    await waitFor(() =>
      expect(lastParams(get)).toMatchObject({ result: "ERRORS", loadId: undefined }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: E.filter.resetAll })).not.toBeInTheDocument(),
    );
  });

  it("danh sách lỗi trống: nói chưa có sự kiện lỗi và mời xem tất cả sự kiện", async () => {
    const user = userEvent.setup();
    const { get } = renderList(ACTORS.manager, {
      list: (params) => ((params as { result?: string }).result ? bePage([]) : bePage(ALL)),
    });
    expect(await screen.findByText(E.empty.noErrorsTitle)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: E.empty.seeAll }));
    expect(await screen.findByText(E.result.APPLIED)).toBeInTheDocument();
    expect(lastParams(get)?.result).toBeUndefined();
  });

  it("chưa có sự kiện nào (xem tất cả) khác với lọc không ra kết quả", async () => {
    renderList(ACTORS.manager, { search: "?result=ALL", list: () => bePage([]) });
    expect(await screen.findByText(E.empty.noDataTitle)).toBeInTheDocument();
    expect(screen.queryByText(EMPTY.noResultsTitle)).not.toBeInTheDocument();
  });

  it("lọc không ra kết quả: nêu 'không tìm thấy' và nút bỏ lọc", async () => {
    const user = userEvent.setup();
    const { get } = renderList(ACTORS.manager, {
      search: "?handling=open",
      list: (params) => ((params as { open?: boolean }).open ? bePage([]) : bePage(ALL)),
    });
    expect(await screen.findByText(EMPTY.noResultsTitle)).toBeInTheDocument();
    expect(screen.getByText(E.empty.noResultsDescription)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: EMPTY.clearFilters }));
    expect(await screen.findByText(E.result.UNMATCHED)).toBeInTheDocument();
    expect(lastParams(get)?.open).toBeUndefined();
  });

  it("không có quyền xem sự kiện hãng: không gọi BE, hiện câu từ chối", async () => {
    const { get } = renderList(ACTORS.noAccess);
    expect(await screen.findByText(UI_LABELS.loadError.forbiddenTitle)).toBeInTheDocument();
    expect(listCalls(get)).toHaveLength(0);
  });
});

describe("CarrierEventList — chi tiết và đánh dấu đã xử lý", () => {
  it("mở sự kiện: nội dung hãng gửi (JSON xuống dòng, chỉ đọc), nghĩa của kết quả và hướng dẫn xử lý tay — không có nút áp lại", async () => {
    const user = userEvent.setup();
    renderList(ACTORS.manager);
    const dialog = await openRow(user, 0);
    expect(await within(dialog).findByLabelText(E.detail.payload)).toHaveTextContent(
      '"loadCode": "LD-99"',
    );
    expect(within(dialog).getByText(E.resultMeaning.UNMATCHED)).toBeInTheDocument();
    expect(within(dialog).getByText(E.guide.text)).toBeInTheDocument();
    expect(within(dialog).getByText(E.kind.DELIVERED)).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /áp lại/i })).not.toBeInTheDocument();
  });

  it("mở sự kiện đã ghép chuyến: có liên kết sang chuyến xe và lô giao", async () => {
    const user = userEvent.setup();
    renderList(ACTORS.manager);
    const dialog = await openRow(user, 1);
    expect(
      await within(dialog).findByRole("link", { name: `${E.detail.openLoad} LD-20261117-0001` }),
    ).toHaveAttribute("href", "/admin/loads/ld-1");
    expect(
      within(dialog).getByRole("link", { name: `${E.detail.openShipment} SO-1-S1` }),
    ).toHaveAttribute("href", "/admin/shipments/sh-1");
  });

  it("ghi chú bắt buộc: chưa nhập thì nút khoá; nhập thì POST đúng ghi chú, đóng hộp thoại và tải lại danh sách", async () => {
    const user = userEvent.setup();
    const { get, post } = renderList(ACTORS.manager);
    const dialog = await openRow(user, 0);
    const submit = await within(dialog).findByRole("button", { name: E.resolve.submit });
    expect(submit).toBeDisabled();
    await user.type(within(dialog).getByLabelText(E.resolve.note, { exact: false }), "   ");
    expect(submit).toBeDisabled();
    await user.type(
      within(dialog).getByLabelText(E.resolve.note, { exact: false }),
      "Đã ghi tay giao thành công",
    );
    await waitFor(() => expect(submit).toBeEnabled());
    const before = listCalls(get).length;
    await user.click(submit);
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0]).toEqual([
      `${LIST_URL}/ev-1/resolution`,
      { note: "Đã ghi tay giao thành công" },
    ]);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(listCalls(get).length).toBeGreaterThan(before));
  });

  it("ghi chú dài hơn giới hạn bị chặn ngay ở ô nhập", async () => {
    const user = userEvent.setup();
    renderList(ACTORS.manager);
    const dialog = await openRow(user, 0);
    const note = await within(dialog).findByLabelText(E.resolve.note, { exact: false });
    expect(note).toHaveAttribute("maxlength", String(CARRIER_EVENT_NOTE_MAX));
  });

  it("409 CARRIER_EVENT_NOT_RESOLVABLE hiện ngay trong hộp thoại, giữ nguyên ghi chú đã gõ", async () => {
    const user = userEvent.setup();
    const { post } = renderList(ACTORS.manager, {
      post: () => {
        throw new ApiError(409, "CARRIER_EVENT_NOT_RESOLVABLE", "en");
      },
    });
    const dialog = await openRow(user, 0);
    const note = await within(dialog).findByLabelText(E.resolve.note, { exact: false });
    await user.type(note, "Đã xử lý");
    await user.click(within(dialog).getByRole("button", { name: E.resolve.submit }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      SHIPPING_EVENT_ERROR_MESSAGES.CARRIER_EVENT_NOT_RESOLVABLE,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(note).toHaveValue("Đã xử lý");
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("chỉ có quyền xem: mở được chi tiết nhưng không có ô ghi chú, không có nút đánh dấu", async () => {
    const user = userEvent.setup();
    renderList(ACTORS.viewer);
    const dialog = await openRow(user, 0);
    await within(dialog).findByLabelText(E.detail.payload);
    expect(
      within(dialog).queryByLabelText(E.resolve.note, { exact: false }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: E.resolve.submit }),
    ).not.toBeInTheDocument();
    expect(within(dialog).queryByText(E.guide.text)).not.toBeInTheDocument();
  });

  it("sự kiện đã xử lý: hiện người, giờ, ghi chú; không còn ô nhập", async () => {
    const user = userEvent.setup();
    renderList(ACTORS.manager);
    const dialog = await openRow(user, 2);
    expect(await within(dialog).findByText(E.resolved.title)).toBeInTheDocument();
    expect(within(dialog).getByText(/Đã hỏi hãng, gửi nhầm/)).toBeInTheDocument();
    expect(within(dialog).getByText(E.resolved.never)).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: E.resolve.submit }),
    ).not.toBeInTheDocument();
  });

  it("sự kiện không thuộc danh sách lỗi (đã áp dụng): không có nút đánh dấu", async () => {
    const user = userEvent.setup();
    renderList(ACTORS.manager);
    const dialog = await openRow(user, 3);
    await within(dialog).findByLabelText(E.detail.payload);
    expect(
      within(dialog).queryByRole("button", { name: E.resolve.submit }),
    ).not.toBeInTheDocument();
  });

  it("'Huỷ' đóng hộp thoại, không gửi gì", async () => {
    const user = userEvent.setup();
    const { post } = renderList(ACTORS.manager);
    const dialog = await openRow(user, 0);
    await within(dialog).findByRole("button", { name: E.resolve.submit });
    await user.click(within(dialog).getByRole("button", { name: "Huỷ" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(post).not.toHaveBeenCalled();
  });
});
