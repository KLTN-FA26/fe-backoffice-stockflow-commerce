"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { useAuthStore } from "../auth-store";
import { homeAreaFor, homeFor } from "../redirect";

import type { ReactNode } from "react";
import type { AppArea } from "../redirect";

/**
 * Giữ mỗi tài khoản ở đúng khu vực: khách (chỉ vai trò CUSTOMER) → `/portal`, nhân viên →
 * `/admin`. Đặt bên trong `AuthGuard`. Chỉ là điều hướng UX — BE vẫn chặn từng API.
 */
export function AreaGate({ area, children }: { area: AppArea; children: ReactNode }) {
  const router = useRouter();
  const roles = useAuthStore((state) => state.user?.roles);
  const wrongArea = roles !== undefined && homeAreaFor(roles) !== area;

  useEffect(() => {
    if (wrongArea && roles) router.replace(homeFor(roles));
  }, [wrongArea, roles, router]);

  if (roles === undefined || wrongArea) return <PageSkeleton />;
  return children;
}
