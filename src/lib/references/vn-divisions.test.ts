import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchVnProvinces, fetchVnWards, joinVnAddress } from "./vn-divisions";

const respond = (body: unknown) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body)));

afterEach(() => vi.restoreAllMocks());

describe("đơn vị hành chính VN 2 cấp (provinces.open-api.vn v2)", () => {
  it("tỉnh / thành: gọi thẳng API công khai, không qua axios của app (không gửi JWT)", async () => {
    const fetchSpy = respond([
      { code: 79, name: "Thành phố Hồ Chí Minh", codename: "ho_chi_minh" },
    ]);
    expect(await fetchVnProvinces()).toEqual([
      { code: 79, name: "Thành phố Hồ Chí Minh", codename: "ho_chi_minh" },
    ]);
    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://provinces.open-api.vn/api/v2/p/");
    expect(init).not.toHaveProperty("headers");
  });

  it("phường / xã của một tỉnh (depth=2); dữ liệu sai định dạng thì báo lỗi, không nhận bừa", async () => {
    respond({
      code: 79,
      name: "Thành phố Hồ Chí Minh",
      codename: "ho_chi_minh",
      wards: [{ code: 25747, name: "Phường Thủ Dầu Một", codename: "phuong_thu_dau_mot" }],
    });
    expect((await fetchVnWards(79)).map((w) => w.name)).toEqual(["Phường Thủ Dầu Một"]);
    respond({ code: 79, name: "x" });
    await expect(fetchVnWards(79)).rejects.toThrow();
  });

  it("ghép địa chỉ một dòng, bỏ phần trống", () => {
    expect(joinVnAddress(" 12 Đường Demo ", "Phường Tân Thuận", "Thành phố Hồ Chí Minh")).toBe(
      "12 Đường Demo, Phường Tân Thuận, Thành phố Hồ Chí Minh",
    );
    expect(joinVnAddress("", "Phường Tân Thuận", "")).toBe("Phường Tân Thuận");
  });
});
