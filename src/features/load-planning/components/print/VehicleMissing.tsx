import { Truck } from "lucide-react";

import { ADMIN_ROUTES, LOAD_PLAN_PRINT_LABELS } from "@/constants";
import { BackLink } from "@/components/shared/BackLink";
import { EmptyState } from "@/components/shared/EmptyState";

/** Xe không có trong kế hoạch (hoặc số xe trong URL sai): báo rõ và dẫn về chi tiết kế hoạch. */
export function VehicleMissing({ id, message }: { id: string; message: string }) {
  return (
    <EmptyState
      icon={<Truck className="size-8" />}
      title={message}
      action={
        <BackLink href={ADMIN_ROUTES.loadPlans.detail(id)} label={LOAD_PLAN_PRINT_LABELS.back} />
      }
    />
  );
}
