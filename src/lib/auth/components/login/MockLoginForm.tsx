"use client";

import { LoaderCircle } from "lucide-react";

import { LOGIN_UI } from "@/constants/labels-login";

import { TitledSelectContent } from "@/components/shared/TitledSelectContent";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import type { MockLoginUser } from "../../auth-api";

interface MockLoginFormProps {
  users: MockLoginUser[];
  loading: boolean;
  selectedUserId: string;
  onSelect: (userId: string) => void;
  pending: boolean;
  onSubmit: () => void;
}

function initials(fullName: string) {
  return fullName
    .split(" ")
    .slice(-2)
    .map((word) => word[0])
    .join("");
}

/** Chế độ mock (`USE_MOCK=true`): chọn một tài khoản nhân sự demo thay cho mật khẩu. */
export function MockLoginForm({
  users,
  loading,
  selectedUserId,
  onSelect,
  pending,
  onSubmit,
}: MockLoginFormProps) {
  const selectedUser = users.find((user) => user.userId === selectedUserId);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="mock-user">{LOGIN_UI.mockUserLabel}</Label>
        <Select
          value={selectedUserId}
          onValueChange={onSelect}
          disabled={loading || users.length === 0}
        >
          <SelectTrigger
            id="mock-user"
            className="border-border-default bg-bg-surface h-10 w-full rounded-[var(--r-md)]"
          >
            <SelectValue
              placeholder={loading ? LOGIN_UI.mockUserLoading : LOGIN_UI.mockUserPlaceholder}
            />
          </SelectTrigger>
          <TitledSelectContent title={LOGIN_UI.mockUserLabel}>
            {users.map((user) => (
              <SelectItem key={user.userId} value={user.userId}>
                {user.fullName} — {user.roles.join(", ")}
              </SelectItem>
            ))}
          </TitledSelectContent>
        </Select>
      </div>

      {selectedUser && (
        <div className="border-border-default bg-bg-subtle rounded-[var(--r-md)] border p-3">
          <div className="flex items-center gap-3">
            <div className="bg-brand text-ink-inverse flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
              {initials(selectedUser.fullName)}
            </div>
            <div className="min-w-0">
              <p className="text-ink-primary truncate text-sm font-medium">
                {selectedUser.fullName}
              </p>
              <p className="text-ink-tertiary truncate text-xs">{selectedUser.email}</p>
            </div>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1">
            {selectedUser.roles.map((role) => (
              <span
                key={role}
                className="border-border-default bg-bg-surface text-ink-secondary rounded-[var(--r-sm)] border px-1.5 py-0.5 font-mono text-[0.6875rem]"
              >
                {role}
              </span>
            ))}
          </div>
        </div>
      )}

      <Button
        type="button"
        className="h-10 w-full rounded-[var(--r-md)]"
        onClick={onSubmit}
        disabled={pending || loading || !selectedUserId}
      >
        {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
        {pending ? LOGIN_UI.submitting : LOGIN_UI.submit}
      </Button>
    </div>
  );
}
