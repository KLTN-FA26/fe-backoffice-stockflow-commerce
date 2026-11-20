import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import { signSalesContract } from "@/features/order/sales-contract-api";

import { totalsDtoSchema } from "../schemas";
import { displayTotals } from "../selectors";

afterEach(() => vi.restoreAllMocks());

describe("tổng báo giá — BE bỏ phần null khi còn khoản chưa giá", () => {
  it("chỉ có subtotal (phí khuôn chưa nhập) vẫn parse được, và không hiện tổng thiếu", () => {
    const proposed = totalsDtoSchema.parse({ subtotal: 69_000_000 });
    expect(displayTotals({ proposed, accepted: null })).toBeNull();
  });

  it.each([{ fees: 0 }, {}, { fees: 1_500_000 }])(
    "dòng chưa giá %j: subtotal vắng vẫn parse, displayTotals = null",
    (raw) => {
      const proposed = totalsDtoSchema.parse(raw);
      expect(proposed.subtotal).toBeNull();
      expect(displayTotals({ proposed, accepted: null })).toBeNull();
    },
  );

  it("đủ bốn số → hiện; đã chấp nhận thắng đề xuất", () => {
    const proposed = { subtotal: 69_000_000, fees: 1_500_000, tax: 5_640_000, total: 76_140_000 };
    const accepted = { subtotal: 23_000_000, fees: 1_500_000, tax: 1_960_000, total: 26_460_000 };
    expect(displayTotals({ proposed, accepted: null })).toEqual(proposed);
    expect(displayTotals({ proposed, accepted })).toEqual(accepted);
  });
});

describe("ghi nhận đã ký — multipart thật, giữ Idempotency-Key", () => {
  it("gửi FormData với Content-Type multipart/form-data", async () => {
    const post = vi.spyOn(api, "post").mockRejectedValue(new Error("stop"));
    const file = new File(["%PDF-1.4"], "hop-dong-da-ky.pdf", { type: "application/pdf" });
    await expect(
      signSalesContract({
        orderId: "o-1",
        version: 3,
        signedOn: "2026-11-19",
        file,
        idempotencyKey: "k-1",
      }),
    ).rejects.toThrow("stop");
    const [, body, config] = post.mock.calls[0] ?? [];
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get("file")).toBe(file);
    expect((body as FormData).get("signedOn")).toBe("2026-11-19");
    expect(config?.headers).toMatchObject({
      "Content-Type": "multipart/form-data",
      "Idempotency-Key": "k-1",
    });
  });
});
