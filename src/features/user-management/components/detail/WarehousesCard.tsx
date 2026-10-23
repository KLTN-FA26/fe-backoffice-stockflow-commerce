"use client";

import { useState } from "react";

import { Card } from "@/components/shared/Card";
import { Button } from "@/components/ui/button";
import { identityErrorMessage } from "@/lib/api/identity-errors";

import { USER_UI } from "../../constants";
import { useAssignWarehouses } from "../../mutations";
import { sameSet, toggleValue, warehouseBoundRoles } from "../../selectors";
import { Checklist } from "../Checklist";

import type { RoleOption } from "@/lib/references/role-options";
import type { ChecklistItem } from "../Checklist";
import type { UserDto } from "../../types";

interface WarehousesCardProps {
  user: UserDto;
  canEdit: boolean;
  /** `null` khi không có quyền đọc danh mục kho: chỉ hiện số kho đang gán, không sửa được. */
  items: readonly ChecklistItem[] | null;
  roles: readonly RoleOption[];
}

/** Kho làm việc: `PUT /users/{id}/warehouses` thay TOÀN BỘ tập kho. Có hiệu lực ở request kế tiếp của người dùng. */
export function WarehousesCard({ user, canEdit, items, roles }: WarehousesCardProps) {
  const mutation = useAssignWarehouses();
  const [draft, setDraft] = useState<{ version: number; ids: string[] }>({
    version: user.version,
    ids: user.warehouseIds,
  });
  // Bản tải lại (version mới) thay bản nháp, tránh gửi đè lên thay đổi của người khác.
  const current = draft.version === user.version ? draft.ids : user.warehouseIds;
  const dirty = !sameSet(current, user.warehouseIds);
  const bound = warehouseBoundRoles(user.roles, roles);

  return (
    <Card>
      <h2 className="text-ink-primary mb-3 text-sm font-semibold">{USER_UI.warehousesLabel}</h2>
      {items ? (
        <Checklist
          legend="Kho được phép thao tác"
          items={items}
          selected={current}
          disabled={!canEdit || mutation.isPending}
          onToggle={(id) => setDraft({ version: user.version, ids: toggleValue(current, id) })}
          emptyText={USER_UI.noWarehousesAtAll}
        />
      ) : (
        <p className="text-ink-secondary text-[0.8125rem]">
          {user.warehouseIds.length} kho đang được gán. Bạn không có quyền xem danh mục kho nên
          không sửa được tại đây.
        </p>
      )}
      {bound.length > 0 && current.length === 0 && (
        <p role="status" className="text-warning mt-3 text-xs">
          Người dùng giữ vai trò chỉ thấy dữ liệu theo kho được gán nhưng chưa có kho nào — họ không
          truy cập được dữ liệu kho.
        </p>
      )}
      {canEdit && items && (
        <Button
          type="button"
          size="sm"
          className="mt-3"
          disabled={!dirty || mutation.isPending}
          onClick={() => mutation.mutate({ userId: user.userId, warehouseIds: current })}
        >
          {mutation.isPending ? USER_UI.saving : "Lưu kho"}
        </Button>
      )}
      {mutation.error && (
        <p role="alert" className="text-danger mt-3 text-[0.8125rem]">
          {identityErrorMessage(mutation.error)}
        </p>
      )}
    </Card>
  );
}
