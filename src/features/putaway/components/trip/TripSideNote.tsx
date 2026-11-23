"use client";

import Link from "next/link";
import { Info } from "lucide-react";

import { PUTAWAY_TRIP_LABELS, PUTAWAY_TRIP_STATUS, WORKSPACE_PATHS } from "@/constants";
import { useWorkspaceHref } from "@/lib/workspace";
import {
  DETAIL_ACTION_CLASS,
  DETAIL_CARD_CLASS,
  DetailCardTitle,
} from "@/components/shared/DetailSection";

import type { ReactNode } from "react";
import type { PutawayTrip } from "@/features/putaway/types";

const L = PUTAWAY_TRIP_LABELS;

/** Cột phải khi không thao tác trên xe: chuyến đã kết thúc, của người khác, hoặc chỉ được xem. */
export function TripSideNote({
  trip,
  text,
  children,
}: {
  trip: PutawayTrip;
  text: string;
  children?: ReactNode;
}) {
  const listHref = useWorkspaceHref()(WORKSPACE_PATHS.putaway);
  const ended =
    trip.status === PUTAWAY_TRIP_STATUS.COMPLETED || trip.status === PUTAWAY_TRIP_STATUS.CLOSED;
  return (
    <section className={DETAIL_CARD_CLASS}>
      <DetailCardTitle icon={Info}>{L.title}</DetailCardTitle>
      <p className="text-ink-secondary mb-3 text-[0.8125rem]">{text}</p>
      <div className="space-y-2">
        {children}
        {ended && (
          <Link
            href={listHref}
            className={`${DETAIL_ACTION_CLASS.outline} flex items-center justify-center`}
          >
            {L.ended.backToList}
          </Link>
        )}
      </div>
    </section>
  );
}
