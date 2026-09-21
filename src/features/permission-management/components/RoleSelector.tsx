import { Label } from "@/components/ui/label";

import type { RoleResponse } from "../types";

interface RoleSelectorProps {
  roles: readonly RoleResponse[];
  value: string;
  onChange: (roleCode: string) => void;
}

export function RoleSelector({ roles, value, onChange }: RoleSelectorProps) {
  return (
    <div className="border-border-default bg-bg-surface rounded-[var(--r-sm)] border p-4">
      <Label htmlFor="permission-role" className="text-ink-primary text-sm font-semibold">
        Vai trò
      </Label>
      <p className="text-ink-secondary mt-1 text-xs">Chọn vai trò để xem ma trận quyền.</p>
      <select
        id="permission-role"
        aria-label="Chọn vai trò để xem ma trận quyền"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border-border-default bg-bg-surface text-ink-primary focus:border-brand focus:ring-brand mt-3 h-9 w-full rounded-[var(--r-sm)] border px-2.5 text-sm outline-none focus:ring-2 sm:max-w-md"
      >
        {roles.map((role) => (
          <option key={role.code} value={role.code}>
            {role.name}
          </option>
        ))}
      </select>
    </div>
  );
}
