"use client";

import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";

import { ApiError } from "@/lib/api/error";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";

import { useRolePermissionMatrix, useRoles } from "../queries";

import { PermissionMatrix } from "./PermissionMatrix";
import { RoleSelector } from "./RoleSelector";

function errorStatus(error: unknown): number | undefined {
  return error instanceof ApiError ? error.status : undefined;
}

function RetryState({ onRetry }: { onRetry: () => void }) {
  return (
    <EmptyState
      title="Không tải được dữ liệu phân quyền"
      description="Kiểm tra kết nối hoặc thử tải lại."
      action={
        <Button
          type="button"
          onClick={onRetry}
          className="bg-brand text-ink-inverse hover:bg-brand-hover rounded-[var(--r-sm)]"
        >
          <RotateCcw className="size-3.5" />
          Tải lại
        </Button>
      }
    />
  );
}

function UnauthorizedState() {
  return (
    <EmptyState
      title="Không có quyền xem ma trận phân quyền"
      description="Bạn không có quyền xem ma trận phân quyền của vai trò này."
    />
  );
}

function NotFoundState() {
  return (
    <EmptyState
      title="Không tìm thấy ma trận phân quyền"
      description="Vai trò có thể đã bị xoá hoặc không còn tồn tại."
    />
  );
}

function MatrixState({ roleCode }: { roleCode: string }) {
  const matrixQuery = useRolePermissionMatrix(roleCode);
  const status = errorStatus(matrixQuery.error);

  if (
    matrixQuery.isPending ||
    (matrixQuery.isFetching && matrixQuery.data?.roleCode !== roleCode)
  ) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="border-border-default rounded-[var(--r-sm)] border p-6"
      >
        <p className="text-ink-secondary text-sm">Đang tải ma trận của vai trò...</p>
      </div>
    );
  }
  if (status === 403) return <UnauthorizedState />;
  if (status === 404) return <NotFoundState />;
  if (matrixQuery.isError || !matrixQuery.data) {
    return <RetryState onRetry={() => void matrixQuery.refetch()} />;
  }
  if (matrixQuery.data.roleCode !== roleCode) {
    return <RetryState onRetry={() => void matrixQuery.refetch()} />;
  }

  return <PermissionMatrix matrix={matrixQuery.data} />;
}

export function PermissionManagementPage() {
  const rolesQuery = useRoles();
  const [selectedRoleCodeState, setSelectedRoleCode] = useState("");
  const roles = useMemo(() => rolesQuery.data ?? [], [rolesQuery.data]);
  const selectedRoleCode = roles.some((role) => role.code === selectedRoleCodeState)
    ? selectedRoleCodeState
    : (roles[0]?.code ?? "");

  if (rolesQuery.isPending) return <PageSkeleton variant="list" />;
  const rolesErrorStatus = errorStatus(rolesQuery.error);
  if (rolesErrorStatus === 403) return <UnauthorizedState />;
  if (rolesQuery.isError) return <RetryState onRetry={() => void rolesQuery.refetch()} />;
  if (roles.length === 0) {
    return (
      <EmptyState
        title="Chưa có vai trò"
        description="Hệ thống chưa trả về vai trò nào để xem ma trận quyền."
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Quản lý phân quyền"
        subtitle="Xem ma trận quyền theo từng vai trò trong hệ thống."
      />
      <div className="space-y-4">
        <RoleSelector roles={roles} value={selectedRoleCode} onChange={setSelectedRoleCode} />
        {selectedRoleCode && <MatrixState key={selectedRoleCode} roleCode={selectedRoleCode} />}
      </div>
    </>
  );
}
