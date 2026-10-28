import { describe, expect, it, vi } from "vitest";

import { refetchFresh } from "./fresh-refetch";

const OLD = Date.now() - 60_000;

describe("refetchFresh — chỉ nhận bản của CHÍNH lần GET này", () => {
  it("GET lỗi nhưng cache còn bản cũ (`refetch()` của TanStack resolve, không ném) → undefined", async () => {
    const refetch = vi.fn(async () => ({
      isSuccess: false,
      data: { version: 7 },
      dataUpdatedAt: OLD,
    }));
    expect(await refetchFresh(refetch)).toBeUndefined();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("thành công nhưng dữ liệu ghi từ trước khi bấm (lần tải bị huỷ / gộp) → undefined", async () => {
    expect(
      await refetchFresh(async () => ({
        isSuccess: true,
        data: { version: 7 },
        dataUpdatedAt: OLD,
      })),
    ).toBeUndefined();
  });

  it("Promise bị từ chối → undefined, không ném", async () => {
    expect(await refetchFresh(() => Promise.reject(new Error("boom")))).toBeUndefined();
  });

  it("thành công, dữ liệu mới ghi sau lúc bấm → trả bản ghi", async () => {
    const fresh = { version: 9 };
    expect(
      await refetchFresh(async () => ({ isSuccess: true, data: fresh, dataUpdatedAt: Date.now() })),
    ).toBe(fresh);
  });
});
