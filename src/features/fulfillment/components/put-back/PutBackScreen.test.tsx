import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  ADMIN_ROUTES,
  FULFILLMENT_PICKING_PERMISSIONS,
  PUT_BACK_ERROR_MESSAGES as PE,
  PUT_BACK_LABELS as P,
  UI_LABELS,
} from "@/constants";
import { ApiError } from "@/lib/api/error";

import {
  LPN_1,
  PICK_LINE_1,
  PICK_LINE_2,
  apiPickLine,
  apiPutBackRow,
} from "../../__fixtures__/pick-lines";
import {
  IDENTITIES,
  mockFulfillmentApi,
  pickInputComboboxOption,
  renderFulfillmentScreen,
} from "../../__fixtures__/render";
import { TASK_ID, WAREHOUSE_ID, bePage } from "../../__fixtures__/task";
import { PutBackScreen } from "./PutBackScreen";

import type { RouteHandler, TestIdentity } from "../../__fixtures__/render";
import type { PutBackRowApiDto } from "../../types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

beforeAll(() => {
  // jsdom không có ResizeObserver / scrollIntoView mà `cmdk` (InputCombobox) dùng
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => {};
});
afterEach(() => vi.restoreAllMocks());

const F = UI_LABELS.fulfillment.filter;
const ORDER = "SO-20261010-000431";
const PUT_BACK_PATH = `/fulfillment/tasks/${TASK_ID}/pick-lines/${PICK_LINE_1}/put-back`;
const PUT_BACK_PATH_2 = `/fulfillment/tasks/${TASK_ID}/pick-lines/${PICK_LINE_2}/put-back`;

interface Options {
  rows?: PutBackRowApiDto[];
  searchParams?: string;
  list?: RouteHandler;
  putBack?: RouteHandler;
  bins?: { locationCode: string; usable: boolean }[];
  /** Khu chứa của kho (loại khu — BE `AreaType`); mặc định có khu chờ xuất + một khu cách ly. */
  areas?: { locationCode: string; usable: boolean; type: string }[];
  layout?: RouteHandler;
}

function renderScreen(identity: TestIdentity, opts: Options = {}) {
  let rows = opts.rows ?? [apiPutBackRow()];
  const putBackHandler: RouteHandler =
    opts.putBack ??
    ((_params, body) => {
      rows = rows.filter((row) => row.lineId !== PICK_LINE_1);
      const { locationCode } = body as { locationCode: string };
      return apiPickLine({
        status: "PUT_BACK",
        pickedQty: 3,
        putBackQty: 3,
        putBackLocationCode: locationCode,
      });
    });
  const spies = mockFulfillmentApi(
    identity,
    {
      "/fulfillment/put-backs": opts.list ?? (() => bePage(rows, 0, 200)),
      "/warehouses": () =>
        bePage([{ id: WAREHOUSE_ID, prefix: "HCM", name: "Kho Hồ Chí Minh", status: "ACTIVE" }]),
      [`/warehouses/${WAREHOUSE_ID}/layout`]:
        opts.layout ??
        (() => ({
          shelves: [
            {
              levels: [
                {
                  bins: opts.bins ?? [
                    { locationCode: "HN-A01-01-01-A", usable: true },
                    { locationCode: "HN-A01-01-02-A", usable: true },
                  ],
                },
              ],
            },
          ],
          areas: opts.areas ?? [
            { locationCode: "HN-STAGE-01", usable: true, type: "STAGING" },
            { locationCode: "HN-QC-01", usable: true, type: "QUARANTINE" },
          ],
        })),
    },
    {
      [PUT_BACK_PATH]: putBackHandler,
      [PUT_BACK_PATH_2]: putBackHandler,
    },
  );
  renderFulfillmentScreen(<PutBackScreen />, undefined, opts.searchParams ?? "");
  return spies;
}

const listCalls = (get: ReturnType<typeof mockFulfillmentApi>["get"]) =>
  get.mock.calls.filter(([url]) => url === "/fulfillment/put-backs");
const putBackCalls = (post: ReturnType<typeof mockFulfillmentApi>["post"]) =>
  post.mock.calls.filter(([url]) => url === PUT_BACK_PATH);
const keyOf = (call: unknown[]) =>
  (call[2] as { headers?: Record<string, string> } | undefined)?.headers?.["Idempotency-Key"];

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: P.actionFor("TEE-BLK-M", ORDER) }));
  return screen.findByRole("dialog");
}

/** Quét LPN của thùng trong dialog cất lại (ô nhập tự do). */
async function scanLpn(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  lpn: string = LPN_1,
) {
  const input = within(dialog).getByLabelText(P.lpn);
  await user.clear(input);
  await user.type(input, lpn);
}

describe("PutBackScreen — hàng đợi trả hàng về kệ (BE GET /fulfillment/put-backs)", () => {
  it("hàng đợi hiện cột, h1 sr-only, không PageHeader", async () => {
    renderScreen(IDENTITIES.warehouseStaff);
    // NV kho: số đơn dạng chữ (link chỉ cho người mở được task — xem describe "link số đơn")
    expect(await screen.findByText(ORDER)).toBeInTheDocument();
    const heading = screen.getByRole("heading", { level: 1, name: P.title });
    expect(heading).toHaveClass("sr-only");
    for (const header of [
      P.column.lpn,
      P.column.sku,
      P.column.lot,
      P.column.pickedQty,
      P.column.fromLocation,
    ]) {
      expect(screen.getByRole("columnheader", { name: header })).toBeInTheDocument();
    }
  });

  it("tìm 'TEE' lọc client theo SKU; badge Search chính có X", async () => {
    const user = userEvent.setup();
    const { get } = renderScreen(IDENTITIES.warehouseStaff, {
      rows: [
        apiPutBackRow(),
        apiPutBackRow({ lineId: PICK_LINE_2, sku: "MUG-WHT", fromLocationCode: "HN-B01" }),
      ],
    });
    expect(await screen.findByText("MUG-WHT")).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText(P.searchPlaceholder), "tee");
    await waitFor(() => expect(screen.queryByText("MUG-WHT")).toBeNull());
    expect(screen.getByText("TEE-BLK-M")).toBeInTheDocument();
    // Lọc ở client: không gọi lại BE theo từ khoá
    expect(listCalls(get)).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Xoá Search chính" }));
    expect(await screen.findByText("MUG-WHT")).toBeInTheDocument();
  });

  it("từ khoá không khớp → EmptyState 'không tìm thấy' + Bỏ lọc", async () => {
    const user = userEvent.setup();
    renderScreen(IDENTITIES.warehouseStaff);
    await screen.findByText("TEE-BLK-M");
    await user.type(screen.getByPlaceholderText(P.searchPlaceholder), "khong-co");
    expect(await screen.findByText(P.noMatch)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: F.clear }));
    expect(await screen.findByText("TEE-BLK-M")).toBeInTheDocument();
  });

  it("?warehouse=WH gửi warehouseId; kho không có hàng → EmptyState riêng + Bỏ lọc kho", async () => {
    const user = userEvent.setup();
    const { get } = renderScreen(IDENTITIES.warehouseManager, {
      rows: [],
      searchParams: `?warehouse=${WAREHOUSE_ID}`,
    });
    expect(await screen.findByText(P.emptyInWarehouse)).toBeInTheDocument();
    expect(listCalls(get).at(-1)?.[1]).toMatchObject({ params: { warehouseId: WAREHOUSE_ID } });
    await user.click(screen.getByRole("button", { name: F.clearWarehouse }));
    await waitFor(() =>
      expect(listCalls(get).at(-1)?.[1]).not.toHaveProperty("params.warehouseId"),
    );
    expect(await screen.findByText(P.empty)).toBeInTheDocument();
  });

  it("totalElements > 200 → câu 'Đang hiện 200/N'", async () => {
    renderScreen(IDENTITIES.warehouseStaff, {
      list: () => ({ ...bePage([apiPutBackRow()], 0, 200), totalElements: 250, totalPages: 2 }),
    });
    expect(await screen.findByText(P.truncated(1, 250))).toBeInTheDocument();
  });

  it("?warehouse= ngoài phạm vi → 403 OUT_OF_DATA_SCOPE → câu báo + Bỏ lọc kho", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    renderScreen(IDENTITIES.warehouseStaff, {
      searchParams: "?warehouse=WH-KHAC",
      list: (params) => {
        if (typeof params === "object" && params !== null && "warehouseId" in params) {
          throw new ApiError(403, "OUT_OF_DATA_SCOPE", "Not authorised for this data");
        }
        return bePage([apiPutBackRow()], 0, 200);
      },
    });
    expect(await screen.findByText(PE.outOfScope)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: F.clearWarehouse }));
    expect(await screen.findByText(ORDER)).toBeInTheDocument();
  });
});

describe("PutBackScreen — link số đơn theo quyền xem task (BE TaskAccess.requireVisible)", () => {
  it("NV kho không giám sát task → số đơn dạng chữ (BE chỉ cho người được gán / giám sát xem chi tiết)", async () => {
    renderScreen(IDENTITIES.warehouseStaff);
    expect(await screen.findByText(ORDER)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: ORDER })).toBeNull();
  });

  it("quản lý kho (task-oversight:READ) → số đơn là link sang chi tiết lấy hàng", async () => {
    renderScreen(IDENTITIES.warehouseManager);
    expect(await screen.findByRole("link", { name: ORDER })).toHaveAttribute(
      "href",
      ADMIN_ROUTES.picking.detail(TASK_ID),
    );
  });
});

describe("PutBackDialog — trả một dòng về kệ (BE POST …/put-back)", () => {
  it("không tải được sơ đồ kho → vẫn trả được về bin đã lấy ra (BE tự kiểm bin)", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { post } = renderScreen(IDENTITIES.warehouseStaff, {
      layout: () => {
        throw new ApiError(403, "FORBIDDEN", "Access denied");
      },
    });
    const dialog = await openDialog(user);
    expect(await within(dialog).findByText(P.locationsFallback)).toBeInTheDocument();
    expect(within(dialog).getByRole("combobox", { name: P.location })).toHaveValue(
      "HN-A01-01-01-A",
    );
    await scanLpn(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: P.action }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        PUT_BACK_PATH,
        { locationCode: "HN-A01-01-01-A", lpn: LPN_1 },
        { headers: { "Idempotency-Key": expect.any(String) } },
      ),
    );
  });

  it("dialog chọn sẵn bin cũ; quét LPN rồi Trả về kệ → POST {locationCode, lpn} + Idempotency-Key; dòng rời hàng đợi", async () => {
    const user = userEvent.setup();
    const { post } = renderScreen(IDENTITIES.warehouseStaff);
    const dialog = await openDialog(user);
    expect(await within(dialog).findByRole("combobox", { name: P.location })).toHaveValue(
      "HN-A01-01-01-A",
    );
    // Dialog nói rõ thùng cần cất: LPN nằm ngay trong mô tả
    expect(dialog).toHaveTextContent(LPN_1);
    await scanLpn(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: P.action }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        PUT_BACK_PATH,
        { locationCode: "HN-A01-01-01-A", lpn: LPN_1 },
        { headers: { "Idempotency-Key": expect.any(String) } },
      ),
    );
    expect(await screen.findByText(P.empty)).toBeInTheDocument();
  });

  it("chưa quét LPN → lỗi dưới ô LPN, không gửi (BE @NotBlank lpn)", async () => {
    const user = userEvent.setup();
    const { post } = renderScreen(IDENTITIES.warehouseStaff);
    const dialog = await openDialog(user);
    await within(dialog).findByDisplayValue("HN-A01-01-01-A");
    await user.click(within(dialog).getByRole("button", { name: P.action }));
    expect(await within(dialog).findByText("Quét hoặc nhập mã LPN của thùng")).toBeInTheDocument();
    expect(putBackCalls(post)).toHaveLength(0);
  });

  it("PICK_ITEM_MISMATCH (quét nhầm thùng) → lỗi dưới ô LPN nêu LPN ĐÚNG của dòng, xoá ô để quét lại", async () => {
    const user = userEvent.setup();
    renderScreen(IDENTITIES.warehouseStaff, {
      putBack: () => {
        throw new ApiError(409, "PICK_ITEM_MISMATCH", "x");
      },
    });
    const dialog = await openDialog(user);
    await within(dialog).findByDisplayValue("HN-A01-01-01-A");
    await scanLpn(user, dialog, "LPN-OF-ANOTHER-ORDER");
    await user.click(within(dialog).getByRole("button", { name: P.action }));
    expect(await within(dialog).findByText(PE.itemMismatch(LPN_1))).toBeInTheDocument();
    expect(within(dialog).getByLabelText(P.lpn)).toHaveValue("");
  });

  it("CARTON_DOES_NOT_FIT_BIN (422, BR-12) → lỗi dưới ô Vị trí trả: chọn bin khác", async () => {
    const user = userEvent.setup();
    renderScreen(IDENTITIES.warehouseStaff, {
      putBack: () => {
        throw new ApiError(422, "CARTON_DOES_NOT_FIT_BIN", "x");
      },
    });
    const dialog = await openDialog(user);
    await within(dialog).findByDisplayValue("HN-A01-01-01-A");
    await scanLpn(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: P.action }));
    expect(await within(dialog).findByText(PE.doesNotFit)).toBeInTheDocument();
  });

  it("hàng đợi hiện LPN; thùng hư hỏng loại ở trạm kiểm (quarantine) có nhãn Cách ly", async () => {
    renderScreen(IDENTITIES.warehouseStaff, {
      rows: [
        apiPutBackRow(),
        apiPutBackRow({
          lineId: PICK_LINE_2,
          lpn: "LPN0000000009",
          sku: "MUG-WHT",
          quarantine: true,
        }),
      ],
    });
    expect(await screen.findByText(LPN_1)).toBeInTheDocument();
    const damaged = screen.getByText("LPN0000000009").closest("tr") as HTMLElement;
    expect(within(damaged).getByText(P.quarantineBadge)).toBeInTheDocument();
    expect(
      within(screen.getByText(LPN_1).closest("tr") as HTMLElement).queryByText(P.quarantineBadge),
    ).toBeNull();
  });

  it("thùng quarantine: chọn KHU CÁCH LY (không phải bin) rồi quét LPN → POST body {khu cách ly, lpn}", async () => {
    const user = userEvent.setup();
    const quarantinePath = PUT_BACK_PATH_2;
    const { post } = renderScreen(IDENTITIES.warehouseStaff, {
      rows: [
        apiPutBackRow({
          lineId: PICK_LINE_2,
          lpn: "LPN0000000009",
          sku: "MUG-WHT",
          quarantine: true,
        }),
      ],
    });
    await user.click(await screen.findByRole("button", { name: P.actionFor("MUG-WHT", ORDER) }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(P.quarantineHint)).toBeInTheDocument();
    // Chỉ khu QUARANTINE đang dùng được: kho chỉ có một → chọn sẵn; bin không có trong danh sách
    expect(await within(dialog).findByRole("combobox", { name: P.quarantineLocation })).toHaveValue(
      "HN-QC-01",
    );
    await user.click(within(dialog).getByRole("combobox", { name: P.quarantineLocation }));
    expect(screen.queryByRole("option", { name: "HN-A01-01-01-A" })).toBeNull();
    expect(screen.queryByRole("option", { name: "HN-STAGE-01" })).toBeNull();
    await user.keyboard("{Escape}");
    await scanLpn(user, dialog, "LPN0000000009");
    await user.click(within(dialog).getByRole("button", { name: P.action }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        quarantinePath,
        { locationCode: "HN-QC-01", lpn: "LPN0000000009" },
        { headers: { "Idempotency-Key": expect.any(String) } },
      ),
    );
  });

  it("bin cũ không dùng được → ô trống, chỉ liệt kê bin dùng được", async () => {
    const user = userEvent.setup();
    renderScreen(IDENTITIES.warehouseStaff, {
      bins: [
        { locationCode: "HN-A01-01-01-A", usable: false },
        { locationCode: "HN-A01-01-02-A", usable: true },
      ],
    });
    const dialog = await openDialog(user);
    const box = await within(dialog).findByRole("combobox", { name: P.location });
    expect(box).toHaveValue("");
    await user.click(box);
    expect(await screen.findByRole("option", { name: "HN-A01-01-02-A" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "HN-A01-01-01-A" })).toBeNull();
    expect(screen.queryByRole("option", { name: "HN-STAGE-01" })).toBeNull();
  });

  it("PUT_BACK_LOCATION_INVALID → lỗi dưới ô Vị trí trả", async () => {
    const user = userEvent.setup();
    renderScreen(IDENTITIES.warehouseStaff, {
      putBack: () => {
        throw new ApiError(409, "PUT_BACK_LOCATION_INVALID", "x");
      },
    });
    const dialog = await openDialog(user);
    await within(dialog).findByDisplayValue("HN-A01-01-01-A");
    await scanLpn(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: P.action }));
    expect(await within(dialog).findByText(PE.locationInvalid)).toBeInTheDocument();
  });

  it("lỗi mạng rồi bấm lại cùng bin → cùng Idempotency-Key; đổi bin → key mới", async () => {
    const user = userEvent.setup();
    const { post } = renderScreen(IDENTITIES.warehouseStaff, {
      putBack: () => {
        throw new ApiError(0, "NETWORK_ERROR", "offline");
      },
    });
    const dialog = await openDialog(user);
    await within(dialog).findByDisplayValue("HN-A01-01-01-A");
    await scanLpn(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: P.action }));
    expect(await within(dialog).findByText(PE.network)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: P.action }));
    await pickInputComboboxOption(user, P.location, "HN-A01-01-02-A");
    await user.click(within(dialog).getByRole("button", { name: P.action }));
    await waitFor(() => expect(putBackCalls(post)).toHaveLength(3));
    const calls = putBackCalls(post);
    expect(keyOf(calls[1] as unknown[])).toBe(keyOf(calls[0] as unknown[]));
    expect(keyOf(calls[2] as unknown[])).not.toBe(keyOf(calls[0] as unknown[]));
  });

  it("không có fulfillment-picking:UPDATE → không có nút Trả về kệ", async () => {
    renderScreen({ permissions: [FULFILLMENT_PICKING_PERMISSIONS.read] });
    expect(await screen.findByText(ORDER)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: P.actionFor("TEE-BLK-M", ORDER) })).toBeNull();
  });

  it("điều phối (không có fulfillment-picking:READ) → bị chặn, không gọi hàng đợi", async () => {
    const { get } = renderScreen(IDENTITIES.orderCoordinator);
    expect(await screen.findByText(UI_LABELS.loadError.forbiddenTitle)).toBeInTheDocument();
    expect(listCalls(get)).toHaveLength(0);
  });
});
