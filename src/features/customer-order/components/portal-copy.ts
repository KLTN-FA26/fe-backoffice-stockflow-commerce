"use client";

import type { LoadErrorCopy } from "@/components/backoffice/LoadErrorState";

export const COPY: LoadErrorCopy = {
  pageTitle: "Đơn hàng",
  notFoundTitle: "Không tìm thấy đơn hàng",
  notFoundDescription: "Đơn hàng không tồn tại hoặc không thuộc doanh nghiệp của bạn.",
  forbiddenDescription: "Tài khoản chưa được cấp quyền xem đơn hàng.",
  noReadDescription: "Tài khoản chưa được cấp quyền xem đơn hàng.",
};

export const MONO = "font-[family-name:var(--font-mono)] tabular-nums";
