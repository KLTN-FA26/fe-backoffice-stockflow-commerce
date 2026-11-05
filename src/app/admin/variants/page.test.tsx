import { describe, expect, it, vi } from "vitest";

import LegacyVariantAttributeDetailPage from "./[id]/page";
import LegacyVariantAttributesPage from "./page";

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));

describe("màn Thuộc tính biến thể cũ (dữ liệu mẫu) → từ điển thuộc tính thật", () => {
  it("/admin/variants và /admin/variants/[id] chuyển hướng về /admin/attributes", () => {
    LegacyVariantAttributesPage();
    LegacyVariantAttributeDetailPage();
    expect(redirect).toHaveBeenNthCalledWith(1, "/admin/attributes");
    expect(redirect).toHaveBeenNthCalledWith(2, "/admin/attributes");
  });
});
