import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useBreadcrumbLabel, useBreadcrumbLabelStore } from "./use-breadcrumb-labels";

const UUID = "d0000001-0000-4000-8000-000000000002";

describe("useBreadcrumbLabel", () => {
  it("đăng ký nhãn khi có dữ liệu và tự gỡ khi rời trang", () => {
    const { rerender, unmount } = renderHook(
      ({ label }: { label?: string }) => useBreadcrumbLabel(UUID, label),
      { initialProps: { label: undefined } as { label?: string } },
    );
    // Chưa tải xong record → chưa có nhãn, breadcrumb vẫn hiện id
    expect(useBreadcrumbLabelStore.getState().labels[UUID]).toBeUndefined();

    rerender({ label: "SUP-002" });
    expect(useBreadcrumbLabelStore.getState().labels[UUID]).toBe("SUP-002");

    unmount();
    expect(useBreadcrumbLabelStore.getState().labels[UUID]).toBeUndefined();
  });
});
