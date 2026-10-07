import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { poDeliveryKeys, useRefreshDeliveriesOnSettle } from "./queries";

import type { ReactNode } from "react";

function setup(initial: boolean) {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(
    ({ inFlight }: { inFlight: boolean }) => useRefreshDeliveriesOnSettle("po-1", inFlight),
    { wrapper, initialProps: { inFlight: initial } },
  );
  return { invalidate, rerender: (inFlight: boolean) => hook.rerender({ inFlight }) };
}

describe("useRefreshDeliveriesOnSettle (BE chỉ ghi dòng lần gửi sau khi gửi xong)", () => {
  it("đang gửi → có kết quả: tải lại lịch sử gửi của đúng PO, một lần", () => {
    const { invalidate, rerender } = setup(true);
    rerender(false);
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: poDeliveryKeys.forPo("po-1") });
    rerender(false);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it("không đi qua trạng thái đang gửi → không tải lại", () => {
    const { invalidate, rerender } = setup(false);
    rerender(false);
    rerender(true);
    expect(invalidate).not.toHaveBeenCalled();
  });
});
