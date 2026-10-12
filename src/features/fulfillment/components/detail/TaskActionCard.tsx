"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import {
  ADMIN_ROUTES,
  FULFILLMENT_PACKAGE_PERMISSIONS,
  FULFILLMENT_PICK_PERMISSIONS,
  PICK_STATUS,
  UI_LABELS,
} from "@/constants";
import { allowedFulfillmentActions } from "@/features/fulfillment/lifecycle";
import {
  useCompletePacking,
  useCompletePicking,
  useStartPicking,
} from "@/features/fulfillment/mutations";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import { AssignDialog } from "../assign/AssignDialog";
import { ReverifyDialog } from "../packing/ReverifyDialog";
import { taskCode } from "../primitives";
import {
  ACTION_ICON,
  CONFIRM_COPY,
  DEFAULT_ACTION_ICON,
  SCOPE_ACTIONS,
  isConfirmCode,
} from "./action-config";
import { noActionText } from "./no-action-text";

import type { FulfillmentActionCode, FulfillmentActor } from "@/features/fulfillment/lifecycle";
import type { FulfillmentTask } from "@/features/fulfillment/types";
import type { FulfillmentScope } from "../primitives";

const { fulfillment } = UI_LABELS;

const BUTTON = "w-full rounded-[var(--r-sm)]";

/**
 * Card thao tác cột phải: trạng thái pick + pack và các nút theo `allowedFulfillmentActions`.
 * Thao tác đổi trạng thái qua ConfirmDialog; đang chạy → khoá nút, chặn bấm hai lần.
 */
export function TaskActionCard({
  task,
  scope,
  actor,
}: {
  task: FulfillmentTask;
  scope: FulfillmentScope;
  actor: FulfillmentActor;
}) {
  const mutations = {
    startPicking: useStartPicking(),
    completePicking: useCompletePicking(),
    completePacking: useCompletePacking(),
  };
  const [dialog, setDialog] = useState<FulfillmentActionCode | null>(null);
  const actions = allowedFulfillmentActions(task, actor).filter((action) =>
    SCOPE_ACTIONS[scope].includes(action.code),
  );
  const pending = Object.values(mutations).some((mutation) => mutation.isPending);
  const confirming = isConfirmCode(dialog) ? dialog : null;
  // Lỗi dữ liệu cũ đã được mutation tự tải lại (withStaleRefetch) — ở đây chỉ đóng dialog
  const callbacks = { onSuccess: () => setDialog(null), onError: () => setDialog(null) };
  const other =
    scope === "picking"
      ? {
          show:
            task.pickStatus === PICK_STATUS.COMPLETED &&
            actor.can(FULFILLMENT_PACKAGE_PERMISSIONS.viewPage),
          href: ADMIN_ROUTES.packing.detail(task.taskId),
          label: fulfillment.action.openPacking,
        }
      : {
          show: actor.can(FULFILLMENT_PICK_PERMISSIONS.viewPage),
          href: ADMIN_ROUTES.picking.detail(task.taskId),
          label: fulfillment.action.openPicking,
        };

  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <dl className="mb-4 space-y-2 text-[0.8125rem]">
        <div className="flex items-center justify-between">
          <dt className="text-ink-secondary">{fulfillment.field.pick}</dt>
          <dd>
            <StatusDot domain="pick" status={task.pickStatus} />
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-ink-secondary">{fulfillment.field.pack}</dt>
          <dd>
            <StatusDot domain="pack" status={task.packStatus} />
          </dd>
        </div>
      </dl>
      <div className="space-y-2">
        {actions.map((action) => {
          const Icon = ACTION_ICON[action.code] ?? DEFAULT_ACTION_ICON;
          return (
            <Button
              key={action.code}
              type="button"
              // Thao tác đổi trạng thái là nút chính (nền brand); gán lại là nút phụ
              variant={action.code === "assign" ? "outline" : "default"}
              size="sm"
              disabled={pending}
              onClick={() => setDialog(action.code)}
              className={BUTTON}
            >
              <Icon className="size-3.5" /> {action.label}
            </Button>
          );
        })}
        {actions.length === 0 && (
          <p className="text-ink-tertiary text-center text-xs">
            {noActionText(task, actor, scope)}
          </p>
        )}
        {other.show && (
          <Button variant="ghost" size="sm" asChild className="text-accent w-full">
            <Link href={other.href}>
              {other.label} <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        )}
      </div>
      {confirming && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          title={fulfillment.action[confirming]}
          description={CONFIRM_COPY[confirming](taskCode(task.taskId))}
          confirmLabel={fulfillment.action[confirming]}
          variant="default"
          loading={mutations[confirming].isPending}
          closeOnConfirm={false}
          onConfirm={() => mutations[confirming].mutate(task.taskId, callbacks)}
        />
      )}
      {dialog === "assign" && <AssignDialog task={task} onClose={() => setDialog(null)} />}
      {dialog === "reverify" && <ReverifyDialog task={task} onClose={() => setDialog(null)} />}
    </section>
  );
}
