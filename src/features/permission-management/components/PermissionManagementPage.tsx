"use client";

import { useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

import { useRbacEditorStore } from "../editor-store";
import { RBAC_EDITOR } from "../constants";
import { useRolePermissionMatrix, useRoles } from "../queries";
import { usePermissionEditor } from "../use-permission-editor";

import { errorStatus, RetryState, UnauthorizedState } from "./MatrixLoadStates";
import { MatrixState } from "./MatrixState";
import { RoleAdminBar } from "./RoleAdminBar";
import { RoleSelector } from "./RoleSelector";

export function PermissionManagementPage() {
  const rolesQuery = useRoles();
  const selectedRoleCodeState = useRbacEditorStore((state) => state.selectedRoleCode);
  const setSelectedRoleCode = useRbacEditorStore((state) => state.setSelectedRoleCode);
  const [pendingRole, setPendingRole] = useState<string | null>(null);
  const roles = useMemo(() => rolesQuery.data ?? [], [rolesQuery.data]);
  const selectedRoleCode = roles.some((role) => role.code === selectedRoleCodeState)
    ? selectedRoleCodeState
    : (roles[0]?.code ?? "");
  const matrixQuery = useRolePermissionMatrix(selectedRoleCode);
  const editor = usePermissionEditor(
    matrixQuery.data?.roleCode === selectedRoleCode ? matrixQuery.data : undefined,
  );
  const selectRole = (roleCode: string) => {
    if (editor.pending || roleCode === selectedRoleCode) return;
    if (editor.dirty) setPendingRole(roleCode);
    else setSelectedRoleCode(roleCode);
  };

  if (rolesQuery.isPending) return <PageSkeleton variant="list" />;
  const rolesErrorStatus = errorStatus(rolesQuery.error);
  if (rolesErrorStatus === 403) {
    return (
      <UnauthorizedState
        title="Không có quyền xem danh sách vai trò"
        description="Bạn không có quyền xem danh sách vai trò và ma trận phân quyền."
      />
    );
  }
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
    // Giao diện kiểu Vercel (globals.css `.surface-soft`): không tiêu đề hiển thị — breadcrumb là tên
    // trang; các khối chọn vai trò / ma trận bo 8px + bóng nhẹ.
    <div className="surface-soft">
      <h1 className="sr-only">Quản lý phân quyền</h1>
      <div className="space-y-4">
        <RoleSelector
          roles={roles}
          value={selectedRoleCode}
          onChange={selectRole}
          disabled={editor.pending}
        />
        <RoleAdminBar
          roles={roles}
          selected={roles.find((role) => role.code === selectedRoleCode)}
          onSelect={selectRole}
          disabled={editor.pending}
        />
        {selectedRoleCode && (
          <MatrixState roleCode={selectedRoleCode} matrixQuery={matrixQuery} editor={editor} />
        )}
      </div>
      <ConfirmDialog
        open={pendingRole !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRole(null);
        }}
        title={RBAC_EDITOR.switchTitle}
        description={RBAC_EDITOR.switchDescription}
        confirmLabel={RBAC_EDITOR.discard}
        onConfirm={() => {
          if (pendingRole !== null) setSelectedRoleCode(pendingRole);
        }}
      />
    </div>
  );
}
