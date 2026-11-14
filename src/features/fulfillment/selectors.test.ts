import { describe, expect, it } from "vitest";

import { shortId } from "./selectors";

describe("fulfillment selectors", () => {
  it("shortId rút gọn để hiển thị", () => {
    expect(shortId("3f2c9a10-7b1d-4e55-9c0a-1d2e3f4a5b6c")).toBe("3F4A5B6C");
    // Id BE sinh theo thời gian: hai bản ghi tạo cùng lúc trùng phần đầu, vẫn phải ra mã khác nhau
    expect(shortId("01a12aba-ed1f-70e8-99ed-eeba1d9cfe37")).not.toBe(
      shortId("01a12aba-ed22-70ba-8804-1ee722c3a3eb"),
    );
  });
});
