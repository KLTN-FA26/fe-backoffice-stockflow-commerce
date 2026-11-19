import { configure, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CARRIER_CONFIG_MESSAGES as CFG,
  CARRIER_FIELD_ERROR_MESSAGES,
  SHIPPING_ERROR_MESSAGES,
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

// Danh mục hành chính là API công khai bên ngoài: thay bằng bản cố định (không gọi mạng trong test)
vi.mock("@/lib/references/vn-divisions", () => ({
  useVnProvinces: () => ({
    isError: false,
    data: [
      { code: 79, name: "Thành phố Hồ Chí Minh", codename: "tp_ho_chi_minh" },
      { code: 1, name: "Thành phố Hà Nội", codename: "tp_ha_noi" },
    ],
  }),
}));

const C = UI_LABELS.shipping.waybill.carriers;
const F = C.form;
const CFGL = C.config;
const A = CFGL.api;
const S = CFGL.serviceCodes;
const P = CFGL.pickupPoints;
const R = CFGL.failureReasons;
const SECRET = CFGL.secret;
const LIST_URL = "/fulfillment/carriers";
const KEY = "k".repeat(12);
const AUTH = "v".repeat(20);

const API_CARRIER = {
  carrierId: "car-ahm",
  code: "AHAMOVE",
  name: "Ahamove",
  status: "ACTIVE",
  version: 6,
  connection: {
    connectionType: "API_BOOKING",
    webhookEnabled: true,
    apiEnvironment: "STAGING",
    apiAccount: "0900000000",
    webhookAuthHeader: "apikey",
    apiKeyConfigured: true,
    webhookAuthValueConfigured: true,
    failureReasonMap: { "Khách vắng": "CUSTOMER_ABSENT" },
  },
};
const MANUAL_CARRIER = { ...CARRIERS[0], contactName: "Lan", version: 2 };
const CODES = [
  {
    vehicleTypeId: "vt-1",
    vehicleTypeCode: "TRUCK-1T25",
    provinceCode: "79",
    carrierCityCode: "SGN",
    serviceCode: "SGN-1T25",
  },
];
const POINTS = [
  {
    warehouseId: "wh-hcm",
    provinceCode: "79",
    address: "1 Lê Lợi, Bến Nghé, Quận 1, TP.HCM",
    contactName: "Thủ kho",
    contactPhone: "0903",
  },
];
const VEHICLE_TYPES = bePage([
  { vehicleTypeId: "vt-1", code: "TRUCK-1T25", name: "Xe tải 1,25 tấn", status: "ACTIVE" },
  { vehicleTypeId: "vt-2", code: "TRUCK-2T5", name: "Xe tải 2,5 tấn", status: "ACTIVE" },
]);

type Handler = (params: unknown, body?: unknown) => unknown;
type User = ReturnType<typeof userEvent.setup>;
interface Options {
  actor?: TestActor;
  list?: unknown[];
  codes?: Handler;
  points?: Handler;
  post?: Handler;
  putCarrier?: Handler;
  putCodes?: Handler;
  putPoints?: Handler;
  services?: Handler;
}

/** Câu trả lời của BE sau khi lưu: các ô chung theo thân gửi, cấu hình đã lưu (cờ `…Configured`), version tăng; KHÔNG có khoá nào. */
function carrierResponse(body: unknown) {
  const sent = body as { name: string; contactName?: string; version: number };
  return {
    ...API_CARRIER,
    name: sent.name,
    contactName: sent.contactName,
    version: sent.version + 1,
  };
}

/** Màn danh mục hãng với API giả lập; `order` ghi thứ tự các lần ghi để kiểm "lưu hãng trước, rồi tới từng danh sách". */
function renderApi(options: Options = {}) {
  const order: string[] = [];
  const track =
    (name: string, handler: Handler): Handler =>
    (params, body) => {
      order.push(name);
      return handler(params, body);
    };
  const spies = mockShippingApi(options.actor ?? ACTORS.warehouseManager, {
    get: {
      [LIST_URL]: () => bePage(options.list ?? [API_CARRIER, MANUAL_CARRIER]),
      "/fulfillment/vehicle-types": () => VEHICLE_TYPES,
      [`${LIST_URL}/car-ahm/service-codes`]: options.codes ?? (() => CODES),
      [`${LIST_URL}/car-ahm/pickup-points`]: options.points ?? (() => POINTS),
      [`${LIST_URL}/car-ahm/services`]: options.services ?? (() => []),
      [`${LIST_URL}/car-ghn/service-codes`]: () => [],
      [`${LIST_URL}/car-ghn/pickup-points`]: () => [],
      [`${LIST_URL}/car-new/service-codes`]: () => [],
      [`${LIST_URL}/car-new/pickup-points`]: () => [],
    },
    post: {
      [LIST_URL]: track(
        "POST carrier",
        options.post ?? (() => ({ ...API_CARRIER, carrierId: "car-new", version: 0 })),
      ),
    },
    put: {
      [`${LIST_URL}/car-ahm`]: track(
        "PUT carrier",
        options.putCarrier ?? ((_p, body) => carrierResponse(body)),
      ),
      [`${LIST_URL}/car-ahm/service-codes`]: track(
        "PUT service-codes",
        options.putCodes ?? ((_p, body) => (body as { codes: unknown[] }).codes),
      ),
      [`${LIST_URL}/car-ahm/pickup-points`]: track(
        "PUT pickup-points",
        options.putPoints ?? ((_p, body) => (body as { pickupPoints: unknown[] }).pickupPoints),
      ),
      [`${LIST_URL}/car-new/service-codes`]: track(
        "PUT service-codes",
        options.putCodes ?? ((_p, body) => (body as { codes: unknown[] }).codes),
      ),
      [`${LIST_URL}/car-new/pickup-points`]: track(
        "PUT pickup-points",
        options.putPoints ?? ((_p, body) => (body as { pickupPoints: unknown[] }).pickupPoints),
      ),
    },
  });
  renderShippingScreen(<CarrierList />);
  return { ...spies, order };
}

// Mỗi test dựng cả hộp thoại + bảng và thao tác nhiều ô: cho dư thời gian khi máy đang tải nặng
vi.setConfig({ testTimeout: 40_000 });
configure({ asyncUtilTimeout: 10_000 });

afterEach(() => {
  vi.restoreAllMocks();
});

/** Gõ cả chuỗi một lần (dán) thay vì từng phím: form có zod validate mỗi lần đổi nên gõ từng phím rất chậm khi máy tải nặng. */
async function fill(user: User, element: HTMLElement, text: string) {
  await user.click(element);
  await user.paste(text);
}

const dialogOf = async () => screen.findByRole("dialog");
const input = (dialog: HTMLElement, label: string) =>
  within(dialog).getByLabelText(label, { selector: "input", exact: false });
/** Nhãn của ô bắt buộc có thêm dấu sao: khớp theo phần đầu. */
const section = (dialog: HTMLElement, name: string) => within(dialog).getByRole("region", { name });
const startsWith = (label: string) => new RegExp(`^${label}`);
const byName = (dialog: HTMLElement, name: string) => within(dialog).getByRole("button", { name });
const bodyOf = (spy: { mock: { calls: unknown[][] } }, index = -1): Record<string, unknown> => {
  const body = spy.mock.calls.at(index)?.[1];
  if (typeof body !== "object" || body === null) throw new Error("Chưa gửi thân yêu cầu nào");
  return Object.fromEntries(Object.entries(body));
};
const callsTo = (spy: { mock: { calls: unknown[][] } }, url: string) =>
  spy.mock.calls.filter(([target]) => target === url);

async function pick(user: User, dialog: HTMLElement, trigger: string | RegExp, option: string) {
  await user.click(within(dialog).getByRole("combobox", { name: trigger }));
  await user.click(await screen.findByRole("option", { name: option }));
}

async function openEdit(user: User, code: string) {
  await user.click(await screen.findByRole("button", { name: C.editAria(code) }));
  return dialogOf();
}

/** Chờ hộp thoại tải xong danh sách đã lưu (mã dịch vụ + điểm lấy hàng). */
async function loaded(dialog: HTMLElement) {
  await within(dialog).findByLabelText(`${S.serviceCode} 1`);
  await within(dialog).findByLabelText(`${P.address} 1`);
}

describe("hãng API đặt xe — tạo mới qua hộp thoại", () => {
  it("chọn kiểu 'Tích hợp API đặt xe' hiện đủ ô cấu hình; POST mang môi trường, tài khoản, khoá, xác thực; không còn câu 'giữ nguyên'", async () => {
    const user = userEvent.setup();
    const { post, order } = renderApi();
    await user.click(await screen.findByRole("button", { name: C.create }));
    const dialog = await dialogOf();
    await fill(user, input(dialog, F.code), "ahm-2");
    await fill(user, input(dialog, F.name), "Ahamove 2");
    expect(within(dialog).getAllByRole("radio")).toHaveLength(3);
    await user.click(within(dialog).getByRole("radio", { name: C.connectionType.API_BOOKING }));
    const save = byName(dialog, F.create);
    expect(save).toBeDisabled();
    await pick(user, dialog, startsWith(A.environment), A.environmentOption.STAGING);
    await fill(user, input(dialog, A.account), "0911111111");
    await fill(user, input(dialog, A.apiKey), KEY);
    await fill(user, input(dialog, A.webhookAuthHeader), "apikey");
    await fill(user, input(dialog, A.webhookAuthValue), AUTH);
    await waitFor(() => expect(save).toBeEnabled());
    await user.click(save);
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(bodyOf(post)).toMatchObject({
      code: "ahm-2",
      name: "Ahamove 2",
      connection: {
        connectionType: "API_BOOKING",
        apiEnvironment: "STAGING",
        apiAccount: "0911111111",
        apiKey: KEY,
        webhookAuthHeader: "apikey",
        webhookAuthValue: AUTH,
      },
    });
    // Bảng chưa đụng tới → không có PUT danh sách nào
    expect(order).toEqual(["POST carrier"]);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("thêm mã dịch vụ + điểm lấy hàng + lý do ngay khi tạo: lưu hãng TRƯỚC (POST), rồi PUT từng danh sách bằng carrierId vừa tạo", async () => {
    const user = userEvent.setup();
    const { post, put, order } = renderApi();
    await user.click(await screen.findByRole("button", { name: C.create }));
    const dialog = await dialogOf();
    await fill(user, input(dialog, F.code), "ahm-2");
    await fill(user, input(dialog, F.name), "Ahamove 2");
    await user.click(within(dialog).getByRole("radio", { name: C.connectionType.API_BOOKING }));
    await pick(user, dialog, startsWith(A.environment), A.environmentOption.PRODUCTION);
    await fill(user, input(dialog, A.account), "0911111111");
    await fill(user, input(dialog, A.apiKey), KEY);
    await fill(user, input(dialog, A.webhookAuthHeader), "Authorization");
    await fill(user, input(dialog, A.webhookAuthValue), AUTH);

    await user.click(byName(dialog, S.add));
    await pick(user, dialog, `${S.vehicleType} 1`, "Xe tải 2,5 tấn (TRUCK-2T5)");
    await pick(user, section(dialog, S.title), `${S.province} 1`, "Thành phố Hồ Chí Minh");
    await fill(user, input(dialog, `${S.carrierCity} 1`), "SGN");
    await fill(user, input(dialog, `${S.serviceCode} 1`), "SGN-2T5");

    await user.click(byName(dialog, P.add));
    await pick(user, section(dialog, P.title), `${P.warehouse} 1`, "HCM · Kho TP.HCM");
    await pick(user, section(dialog, P.title), `${P.province} 1`, "Thành phố Hồ Chí Minh");
    await fill(user, input(dialog, `${P.address} 1`), "1 Lê Lợi, Quận 1");

    await user.click(byName(dialog, R.add));
    await fill(user, input(dialog, `${R.wording} 1`), "Khách không nghe máy");
    await pick(user, dialog, `${R.reason} 1`, "Khách vắng mặt");

    const save = byName(dialog, F.create);
    await waitFor(() => expect(save).toBeEnabled());
    await user.click(save);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(order).toEqual(["POST carrier", "PUT service-codes", "PUT pickup-points"]);
    expect(bodyOf(post).connection).toMatchObject({
      failureReasonMap: { "Khách không nghe máy": "CUSTOMER_ABSENT" },
    });
    expect(callsTo(put, `${LIST_URL}/car-new/service-codes`)[0]?.[1]).toEqual({
      codes: [
        {
          vehicleTypeId: "vt-2",
          provinceCode: "79",
          carrierCityCode: "SGN",
          serviceCode: "SGN-2T5",
        },
      ],
    });
    expect(callsTo(put, `${LIST_URL}/car-new/pickup-points`)[0]?.[1]).toEqual({
      pickupPoints: [
        {
          warehouseId: "wh-hcm",
          provinceCode: "79",
          address: "1 Lê Lợi, Quận 1",
          contactName: undefined,
          contactPhone: undefined,
        },
      ],
    });
  });

  it("dòng bỏ trống không chặn lưu; dòng điền dở chặn lưu (nút Lưu tắt)", async () => {
    const user = userEvent.setup();
    renderApi();
    await user.click(await screen.findByRole("button", { name: C.create }));
    const dialog = await dialogOf();
    await fill(user, input(dialog, F.code), "ahm-2");
    await fill(user, input(dialog, F.name), "Ahamove 2");
    await user.click(within(dialog).getByRole("radio", { name: C.connectionType.API_BOOKING }));
    await pick(user, dialog, startsWith(A.environment), A.environmentOption.STAGING);
    await fill(user, input(dialog, A.account), "0911111111");
    await fill(user, input(dialog, A.apiKey), KEY);
    await fill(user, input(dialog, A.webhookAuthHeader), "apikey");
    await fill(user, input(dialog, A.webhookAuthValue), AUTH);
    const save = byName(dialog, F.create);
    await user.click(byName(dialog, S.add));
    await waitFor(() => expect(save).toBeEnabled());
    await fill(user, input(dialog, `${S.serviceCode} 1`), "SGN-2T5");
    await waitFor(() => expect(save).toBeDisabled());
  });
});

describe("hãng API đặt xe — khoá chỉ đi vào", () => {
  it("mở hãng đã lưu: khoá API và xác thực webhook chỉ hiện 'Đã lưu', không có ô nào chứa giá trị cũ; header hiện rõ", async () => {
    const user = userEvent.setup();
    renderApi();
    const dialog = await openEdit(user, "AHAMOVE");
    await loaded(dialog);
    expect(within(dialog).getAllByText(SECRET.saved)).toHaveLength(2);
    expect(dialog.querySelectorAll("input[type=password]")).toHaveLength(0);
    expect(input(dialog, A.webhookAuthHeader)).toHaveValue("apikey");
    expect(input(dialog, A.account)).toHaveValue("0900000000");
    expect(
      within(dialog).getByRole("combobox", { name: startsWith(A.environment) }),
    ).toHaveTextContent(A.environmentOption.STAGING);
    // Không bản nào của khoá nằm trong DOM
    expect(dialog.innerHTML).not.toContain(KEY);
  });

  it("bấm 'Thay khoá' mở ô nhập kiểu mật khẩu TRỐNG; 'Giữ khoá hiện tại' đóng lại và xoá chữ đã gõ", async () => {
    const user = userEvent.setup();
    renderApi();
    const dialog = await openEdit(user, "AHAMOVE");
    await loaded(dialog);
    await user.click(byName(dialog, SECRET.replaceAria(A.apiKey)));
    const key = input(dialog, A.apiKey);
    expect(key).toHaveAttribute("type", "password");
    expect(key).toHaveValue("");
    await fill(user, key, KEY);
    await user.click(byName(dialog, SECRET.keepAria(A.apiKey)));
    expect(within(dialog).getAllByText(SECRET.saved)).toHaveLength(2);
    await user.click(byName(dialog, SECRET.replaceAria(A.apiKey)));
    expect(input(dialog, A.apiKey)).toHaveValue("");
  });

  it("lưu không đụng khoá: PUT không có khoá nào (BE giữ khoá đã lưu), không PUT danh sách chưa sửa, không gửi bảng lý do chưa sửa", async () => {
    const user = userEvent.setup();
    const { put, order } = renderApi();
    const dialog = await openEdit(user, "AHAMOVE");
    await loaded(dialog);
    await fill(user, input(dialog, F.contactName), "Liên hệ mới");
    await user.click(byName(dialog, F.save));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(order).toEqual(["PUT carrier"]);
    const connection = bodyOf(put).connection as Record<string, unknown>;
    expect(connection).toMatchObject({
      connectionType: "API_BOOKING",
      apiEnvironment: "STAGING",
      apiAccount: "0900000000",
      webhookAuthHeader: "apikey",
    });
    expect(connection.apiKey).toBeUndefined();
    expect(connection.webhookAuthValue).toBeUndefined();
    expect(connection.failureReasonMap).toBeUndefined();
    expect(bodyOf(put).version).toBe(API_CARRIER.version);
  });

  it("thay khoá: khoá mới đi cùng PUT; sau khi lưu không còn trong state (mở lại là 'Đã lưu')", async () => {
    const user = userEvent.setup();
    const { put } = renderApi({
      // Lưu hãng xong, danh sách phải lưu lỗi để hộp thoại ở lại và ta kiểm state sau khi lưu
      putCodes: () => {
        throw new ApiError(409, "CARRIER_NOT_API_BOOKING", "en");
      },
    });
    const dialog = await openEdit(user, "AHAMOVE");
    await loaded(dialog);
    await user.click(byName(dialog, SECRET.replaceAria(A.apiKey)));
    await fill(user, input(dialog, A.apiKey), KEY);
    await user.click(byName(dialog, S.add));
    await pick(user, dialog, `${S.vehicleType} 2`, "Xe tải 2,5 tấn (TRUCK-2T5)");
    await pick(user, section(dialog, S.title), `${S.province} 2`, "Thành phố Hà Nội");
    await fill(user, input(dialog, `${S.carrierCity} 2`), "HAN");
    await fill(user, input(dialog, `${S.serviceCode} 2`), "HAN-2T5");
    await user.click(byName(dialog, F.save));
    await waitFor(() => expect(put).toHaveBeenCalledTimes(2));
    expect((bodyOf(put, 0).connection as { apiKey?: string }).apiKey).toBe(KEY);
    // Hãng đã lưu: khoá không còn trong form, ô quay về 'Đã lưu'
    await waitFor(() => expect(within(dialog).getAllByText(SECRET.saved)).toHaveLength(2));
    expect(dialog.querySelectorAll("input[type=password]")).toHaveLength(0);
    expect(dialog.innerHTML).not.toContain(KEY);
  });

  it("đổi môi trường khi đã có khoá: ô khoá API mở sẵn, nút Lưu tắt cho tới khi nhập khoá mới (luật BE); nhập rồi PUT mang khoá mới", async () => {
    const user = userEvent.setup();
    const { put } = renderApi();
    const dialog = await openEdit(user, "AHAMOVE");
    await loaded(dialog);
    const save = byName(dialog, F.save);
    await waitFor(() => expect(save).toBeEnabled());
    await pick(user, dialog, startsWith(A.environment), A.environmentOption.PRODUCTION);
    expect(await within(dialog).findByText(A.apiKeyChangeNeedsNew)).toBeVisible();
    expect(input(dialog, A.apiKey)).toHaveValue("");
    expect(save).toBeDisabled();
    await fill(user, input(dialog, A.apiKey), KEY);
    await waitFor(() => expect(save).toBeEnabled());
    await user.click(save);
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(bodyOf(put).connection).toMatchObject({
      apiEnvironment: "PRODUCTION",
      apiKey: KEY,
    });
  });

  it("đổi tài khoản khi đã có khoá: cũng buộc nhập khoá mới", async () => {
    const user = userEvent.setup();
    renderApi();
    const dialog = await openEdit(user, "AHAMOVE");
    await loaded(dialog);
    await user.clear(input(dialog, A.account));
    await fill(user, input(dialog, A.account), "0922222222");
    await waitFor(() => expect(byName(dialog, F.save)).toBeDisabled());
    expect(input(dialog, A.apiKey)).toHaveValue("");
  });

  it("khoá ngắn hơn 8 ký tự bị chặn ngay ở form", async () => {
    const user = userEvent.setup();
    renderApi();
    const dialog = await openEdit(user, "AHAMOVE");
    await loaded(dialog);
    await user.click(byName(dialog, SECRET.replaceAria(A.apiKey)));
    await fill(user, input(dialog, A.apiKey), "ngan");
    expect(await within(dialog).findByText(CFG.apiKeyInvalid)).toBeVisible();
    expect(byName(dialog, F.save)).toBeDisabled();
  });

  it("thay giá trị xác thực webhook: giá trị mới đi cùng PUT; đang xoay khoá thì có dòng giải thích", async () => {
    const user = userEvent.setup();
    const rotating = {
      ...API_CARRIER,
      connection: { ...API_CARRIER.connection, webhookAuthValueNextConfigured: true },
    };
    const { put } = renderApi({ list: [rotating] });
    const dialog = await openEdit(user, "AHAMOVE");
    await loaded(dialog);
    expect(within(dialog).getByText(A.rotationUnderWay)).toBeInTheDocument();
    await user.click(byName(dialog, SECRET.replaceAria(A.webhookAuthValue)));
    await fill(user, input(dialog, A.webhookAuthValue), AUTH);
    await user.click(byName(dialog, F.save));
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(bodyOf(put).connection).toMatchObject({ webhookAuthValue: AUTH });
    expect((bodyOf(put).connection as { apiKey?: string }).apiKey).toBeUndefined();
  });
});

describe("hãng API đặt xe — mã dịch vụ, điểm lấy hàng, lý do giao thất bại", () => {
  it("hiện bảng đã lưu (tên loại xe, tỉnh, điểm lấy hàng); sửa mã dịch vụ → PUT hãng rồi PUT cả danh sách mới", async () => {
    const user = userEvent.setup();
    const { put, order } = renderApi();
    const dialog = await openEdit(user, "AHAMOVE");
    await loaded(dialog);
    expect(within(dialog).getByRole("combobox", { name: `${S.vehicleType} 1` })).toHaveTextContent(
      "Xe tải 1,25 tấn (TRUCK-1T25)",
    );
    expect(
      within(section(dialog, S.title)).getByRole("combobox", { name: `${S.province} 1` }),
    ).toHaveTextContent("Thành phố Hồ Chí Minh");
    expect(input(dialog, `${P.address} 1`)).toHaveValue(POINTS[0]?.address);
    await user.clear(input(dialog, `${S.serviceCode} 1`));
    await fill(user, input(dialog, `${S.serviceCode} 1`), "SGN-MOI");
    await user.click(byName(dialog, F.save));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(order).toEqual(["PUT carrier", "PUT service-codes"]);
    expect(callsTo(put, `${LIST_URL}/car-ahm/service-codes`)[0]?.[1]).toEqual({
      codes: [
        {
          vehicleTypeId: "vt-1",
          provinceCode: "79",
          carrierCityCode: "SGN",
          serviceCode: "SGN-MOI",
        },
      ],
    });
  });

  it("xoá hết dòng mã dịch vụ = PUT danh sách rỗng (BE thay cả danh sách)", async () => {
    const user = userEvent.setup();
    const { put } = renderApi();
    const dialog = await openEdit(user, "AHAMOVE");
    await loaded(dialog);
    const section = within(dialog).getByRole("region", { name: S.title });
    await user.click(within(section).getByRole("button", { name: CFGL.table.removeAria(1) }));
    expect(within(section).getByText(S.empty)).toBeVisible();
    await user.click(byName(dialog, F.save));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(callsTo(put, `${LIST_URL}/car-ahm/service-codes`)[0]?.[1]).toEqual({ codes: [] });
  });

  it("mã dịch vụ trùng (cùng loại xe + tỉnh) và điểm lấy hàng trùng kho bị chặn kèm câu tiếng Việt", async () => {
    const user = userEvent.setup();
    renderApi();
    const dialog = await openEdit(user, "AHAMOVE");
    await loaded(dialog);
    await user.click(byName(dialog, S.add));
    await pick(user, dialog, `${S.vehicleType} 2`, "Xe tải 1,25 tấn (TRUCK-1T25)");
    await pick(user, section(dialog, S.title), `${S.province} 2`, "Thành phố Hồ Chí Minh");
    await fill(user, input(dialog, `${S.carrierCity} 2`), "SGN");
    await fill(user, input(dialog, `${S.serviceCode} 2`), "KHAC");
    expect(await within(dialog).findByText(CFG.serviceCodeDuplicate)).toBeVisible();
    expect(byName(dialog, F.save)).toBeDisabled();
  });

  it("sửa bảng lý do giao thất bại: PUT mang đủ bảng mới; lý do trùng (không phân biệt hoa thường) bị chặn", async () => {
    const user = userEvent.setup();
    const { put } = renderApi();
    const dialog = await openEdit(user, "AHAMOVE");
    await loaded(dialog);
    expect(input(dialog, `${R.wording} 1`)).toHaveValue("Khách vắng");
    await user.click(byName(dialog, R.add));
    await fill(user, input(dialog, `${R.wording} 2`), "KHÁCH VẮNG");
    await pick(user, dialog, `${R.reason} 2`, "Khách từ chối nhận");
    expect(await within(dialog).findByText(CFG.wordingDuplicate)).toBeVisible();
    expect(byName(dialog, F.save)).toBeDisabled();
    await user.clear(input(dialog, `${R.wording} 2`));
    await fill(user, input(dialog, `${R.wording} 2`), "Hàng bị trả");
    await waitFor(() => expect(byName(dialog, F.save)).toBeEnabled());
    await user.click(byName(dialog, F.save));
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect((bodyOf(put).connection as { failureReasonMap?: unknown }).failureReasonMap).toEqual({
      "Khách vắng": "CUSTOMER_ABSENT",
      "Hàng bị trả": "REFUSED",
    });
  });

  it("xoá hết lý do = gửi {} (BE xoá bảng); không sửa gì thì không gửi bảng", async () => {
    const user = userEvent.setup();
    const { put } = renderApi();
    const dialog = await openEdit(user, "AHAMOVE");
    await loaded(dialog);
    const section = within(dialog).getByRole("region", { name: R.title });
    await user.click(within(section).getByRole("button", { name: CFGL.table.removeAria(1) }));
    await user.click(byName(dialog, F.save));
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect((bodyOf(put).connection as { failureReasonMap?: unknown }).failureReasonMap).toEqual({});
  });

  it("hãng webhook theo chuyến cũng có bảng lý do giao thất bại, không có mã dịch vụ / điểm lấy hàng; hãng thường không có bảng nào", async () => {
    const user = userEvent.setup();
    const webhook = {
      ...CARRIERS[1],
      version: 3,
      connection: { ...CARRIERS[1]?.connection, failureReasonMap: { "Hết thời gian": "OTHER" } },
    };
    renderApi({ list: [webhook, MANUAL_CARRIER] });
    let dialog = await openEdit(user, "VTP");
    expect(input(dialog, `${R.wording} 1`)).toHaveValue("Hết thời gian");
    expect(within(dialog).queryByRole("region", { name: S.title })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Huỷ" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    dialog = await openEdit(user, "GHN");
    expect(within(dialog).queryByRole("region", { name: R.title })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("region", { name: S.title })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("region", { name: P.title })).not.toBeInTheDocument();
  });
});

describe("hãng API đặt xe — lưu một phần và lỗi", () => {
  it("hãng lưu xong mà mã dịch vụ lỗi: hộp thoại ở lại, nói rõ phần nào đã / chưa lưu; Lưu lại dùng version mới và chỉ thử lại phần lỗi", async () => {
    const user = userEvent.setup();
    let failCodes = true;
    const { put, order } = renderApi({
      putCodes: (_p, body) => {
        if (failCodes) throw new ApiError(404, "VEHICLE_TYPE_NOT_FOUND", "en");
        return (body as { codes: unknown[] }).codes;
      },
    });
    const dialog = await openEdit(user, "AHAMOVE");
    await loaded(dialog);
    await user.clear(input(dialog, `${S.serviceCode} 1`));
    await fill(user, input(dialog, `${S.serviceCode} 1`), "SGN-MOI");
    await user.click(byName(dialog, F.save));
    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent(
      CFGL.saveProgress.partial(
        [CFGL.saveProgress.carrierPart],
        [
          `${CFGL.saveProgress.serviceCodesPart} (${SHIPPING_ERROR_MESSAGES.VEHICLE_TYPE_NOT_FOUND})`,
        ],
      ),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(order).toEqual(["PUT carrier", "PUT service-codes"]);
    // Lần Lưu sau: hãng dùng version mới (6 → 7), mã dịch vụ vẫn còn trong bảng để gửi lại
    failCodes = false;
    await waitFor(() => expect(byName(dialog, F.save)).toBeEnabled());
    await user.click(byName(dialog, F.save));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(
      callsTo(put, `${LIST_URL}/car-ahm`).map(([, body]) => (body as { version: number }).version),
    ).toEqual([6, 7]);
    expect(order).toEqual(["PUT carrier", "PUT service-codes", "PUT carrier", "PUT service-codes"]);
  });

  it("hãng mới tạo xong mà điểm lấy hàng lỗi: hộp thoại thành 'Sửa hãng' (nút 'Lưu thay đổi'), lần Lưu sau PUT hãng vừa tạo chứ không POST lại", async () => {
    const user = userEvent.setup();
    const { post } = renderApi({
      putPoints: () => {
        throw new ApiError(403, "OUT_OF_DATA_SCOPE", "en");
      },
    });
    await user.click(await screen.findByRole("button", { name: C.create }));
    const dialog = await dialogOf();
    await fill(user, input(dialog, F.code), "ahm-2");
    await fill(user, input(dialog, F.name), "Ahamove 2");
    await user.click(within(dialog).getByRole("radio", { name: C.connectionType.API_BOOKING }));
    await pick(user, dialog, startsWith(A.environment), A.environmentOption.STAGING);
    await fill(user, input(dialog, A.account), "0911111111");
    await fill(user, input(dialog, A.apiKey), KEY);
    await fill(user, input(dialog, A.webhookAuthHeader), "apikey");
    await fill(user, input(dialog, A.webhookAuthValue), AUTH);
    await user.click(byName(dialog, P.add));
    await pick(user, section(dialog, P.title), `${P.warehouse} 1`, "HN · Kho Hà Nội");
    await pick(user, section(dialog, P.title), `${P.province} 1`, "Thành phố Hà Nội");
    await fill(user, input(dialog, `${P.address} 1`), "1 Tràng Tiền");
    await user.click(byName(dialog, F.create));
    await within(dialog).findByRole("alert");
    expect(post).toHaveBeenCalledTimes(1);
    expect(within(dialog).getByText(F.editTitle)).toBeInTheDocument();
    expect(byName(dialog, F.save)).toBeInTheDocument();
    expect(within(dialog).getByRole("alert")).toHaveTextContent(CFGL.saveProgress.pickupPointsPart);
    expect(dialog.innerHTML).not.toContain(KEY);
  });

  it("503 SECRETS_UNAVAILABLE khi lưu hãng: câu tiếng Việt, hộp thoại giữ nguyên", async () => {
    const user = userEvent.setup();
    renderApi({
      putCarrier: () => {
        throw new ApiError(503, "SECRETS_UNAVAILABLE", "en");
      },
    });
    const dialog = await openEdit(user, "AHAMOVE");
    await loaded(dialog);
    await fill(user, input(dialog, F.contactName), "x");
    await user.click(byName(dialog, F.save));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      SHIPPING_ERROR_MESSAGES.SECRETS_UNAVAILABLE,
    );
  });

  it("lỗi từng ô của BE hiện bằng câu tiếng Việt dưới đúng ô (không in câu tiếng Anh của BE)", async () => {
    const user = userEvent.setup();
    renderApi({
      putCarrier: () => {
        throw new ApiError(400, "VALIDATION_FAILED", "en", {
          apiKey:
            "a key is issued to one account in one environment: give the key of this account in PRODUCTION",
        });
      },
    });
    const dialog = await openEdit(user, "AHAMOVE");
    await loaded(dialog);
    await fill(user, input(dialog, F.contactName), "x");
    await user.click(byName(dialog, F.save));
    await within(dialog).findByText(CARRIER_FIELD_ERROR_MESSAGES.apiKey);
    expect(dialog.textContent).not.toContain("issued to one account");
  });

  it("409 OPTIMISTIC_LOCK vẫn nói câu riêng của hãng và không ghi danh sách nào", async () => {
    const user = userEvent.setup();
    const { order } = renderApi({
      putCarrier: () => {
        throw new ApiError(409, "OPTIMISTIC_LOCK", "en");
      },
    });
    const dialog = await openEdit(user, "AHAMOVE");
    await loaded(dialog);
    await user.clear(input(dialog, `${S.serviceCode} 1`));
    await fill(user, input(dialog, `${S.serviceCode} 1`), "SGN-MOI");
    await user.click(byName(dialog, F.save));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(F.stale);
    expect(order).toEqual(["PUT carrier"]);
  });

  it("không tải được danh sách đã lưu: bảng báo lỗi + 'Thử lại', KHÔNG ghi đè danh sách ở BE khi lưu hãng", async () => {
    const user = userEvent.setup();
    let fail = true;
    const { order } = renderApi({
      codes: () => {
        if (fail) throw new ApiError(500, "INTERNAL_ERROR", "en");
        return CODES;
      },
    });
    const dialog = await openEdit(user, "AHAMOVE");
    const region = await within(dialog).findByRole("region", { name: S.title });
    expect(await within(region).findByText(new RegExp(CFGL.table.loadFailed))).toBeVisible();
    expect(within(region).queryByRole("button", { name: S.add })).not.toBeInTheDocument();
    await within(dialog).findByLabelText(`${P.address} 1`);
    await fill(user, input(dialog, F.contactName), "x");
    await user.click(byName(dialog, F.save));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(order).toEqual(["PUT carrier"]);
    fail = false;
  });
});

describe("hãng API đặt xe — tra dịch vụ của hãng (gọi API hãng, chỉ giả lập trong test)", () => {
  it("hãng đã lưu: bấm 'Tra dịch vụ' gọi /services?cityId đúng một lần, chọn một dịch vụ điền vào ô mã dịch vụ", async () => {
    const user = userEvent.setup();
    const { get } = renderApi({
      services: () => [
        { serviceCode: "SGN-TRUCK-500", name: "Xe tải 500 kg", cityId: "SGN" },
        { serviceCode: "SGN-TRUCK-1000", name: "Xe tải 1 tấn", cityId: "SGN" },
      ],
    });
    const dialog = await openEdit(user, "AHAMOVE");
    await loaded(dialog);
    const url = `${LIST_URL}/car-ahm/services`;
    expect(callsTo(get, url)).toHaveLength(0);
    await user.click(byName(dialog, S.lookupAria(1)));
    const panel = await within(dialog).findByRole("region", { name: S.lookupTitle });
    expect(await within(panel).findByText("Xe tải 1 tấn ·", { exact: false })).toBeVisible();
    expect(callsTo(get, url)).toHaveLength(1);
    expect((callsTo(get, url)[0]?.[1] as { params: unknown }).params).toEqual({ cityId: "SGN" });
    const pickButtons = within(panel).getAllByRole("button", { name: S.lookupPick });
    await user.click(pickButtons[1] as HTMLElement);
    expect(input(dialog, `${S.serviceCode} 1`)).toHaveValue("SGN-TRUCK-1000");
    expect(within(dialog).queryByRole("region", { name: S.lookupTitle })).not.toBeInTheDocument();
  });

  it("hãng từ chối (422): câu tiếng Việt, không in lý do thô của hãng", async () => {
    const user = userEvent.setup();
    renderApi({
      services: () => {
        throw new ApiError(422, "CARRIER_BOOKING_FAILED", "en", { carrier: "invalid api_key xyz" });
      },
    });
    const dialog = await openEdit(user, "AHAMOVE");
    await loaded(dialog);
    await user.click(byName(dialog, S.lookupAria(1)));
    expect(await within(dialog).findByText(S.lookupRefused)).toBeVisible();
    expect(dialog.textContent).not.toContain("invalid api_key");
  });

  it("hãng chưa lưu ở kiểu API (đang tạo) hoặc ô mã thành phố trống: nút tra tắt, không gọi gì", async () => {
    const user = userEvent.setup();
    const { get } = renderApi();
    await user.click(await screen.findByRole("button", { name: C.create }));
    const dialog = await dialogOf();
    await user.click(within(dialog).getByRole("radio", { name: C.connectionType.API_BOOKING }));
    await user.click(byName(dialog, S.add));
    await fill(user, input(dialog, `${S.carrierCity} 1`), "SGN");
    expect(byName(dialog, S.lookupAria(1))).toBeDisabled();
    expect(callsTo(get, `${LIST_URL}/car-ahm/services`)).toHaveLength(0);
    expect(get.mock.calls.some(([url]) => String(url).endsWith("/services"))).toBe(false);
  });
});

describe("hãng API đặt xe — quyền", () => {
  it.each([
    ["nhân viên kho", ACTORS.warehouseStaff],
    ["người chỉ xem", ACTORS.viewOnly],
  ])(
    "%s (không có fulfillment-carriers:UPDATE) không có nút sửa / thêm, không đọc danh sách cấu hình của hãng, không ghi gì",
    async (_name, actor) => {
      const { get, put, post } = renderApi({ actor });
      await screen.findByText("Ahamove");
      expect(screen.queryByRole("button", { name: C.editAria("AHAMOVE") })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: C.create })).not.toBeInTheDocument();
      expect(get.mock.calls.some(([url]) => String(url).includes("service-codes"))).toBe(false);
      expect(get.mock.calls.some(([url]) => String(url).includes("pickup-points"))).toBe(false);
      expect(put).not.toHaveBeenCalled();
      expect(post).not.toHaveBeenCalled();
    },
  );
});
