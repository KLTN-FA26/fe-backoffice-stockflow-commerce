"use client";

import dynamic from "next/dynamic";

import { REPORTING_LABELS } from "@/constants/reporting";

import { formatMoney, formatNumber } from "@/lib/format";

import { Skeleton } from "@/components/shared/Skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { useOrderStatusCounts, useSalesDaily, useTopProducts } from "../queries";
import { hasSales, toStatusBars, topProductLabel, visibleStatusBars } from "../selectors";
import { ReportCard } from "./ReportCard";

import type { DateRange } from "@/lib/date-range";

const L = REPORTING_LABELS;

// recharts is heavy → separate chunk, loaded only when the section renders (api-conventions §9).
const SalesDailyChart = dynamic(() => import("./SalesDailyChart"), {
  ssr: false,
  loading: () => <Skeleton className="h-[300px] w-full" />,
});
const OrderStatusChart = dynamic(() => import("./OrderStatusChart"), {
  ssr: false,
  loading: () => <Skeleton className="h-[280px] w-full" />,
});

export function SalesDailyWidget({ range }: { range: DateRange }) {
  const query = useSalesDaily(range, true);
  const rows = query.data ?? [];
  return (
    <ReportCard
      title={L.dailyTitle}
      isPending={query.isPending}
      isError={query.isError}
      isEmpty={!hasSales(rows)}
      onRetry={() => void query.refetch()}
      skeletonClass="h-[300px]"
    >
      <SalesDailyChart rows={rows} />
    </ReportCard>
  );
}

export function TopProductsWidget({ range }: { range: DateRange }) {
  const query = useTopProducts(range, true);
  const rows = query.data ?? [];
  return (
    <ReportCard
      title={L.topTitle}
      isPending={query.isPending}
      isError={query.isError}
      isEmpty={rows.length === 0}
      onRetry={() => void query.refetch()}
    >
      <Table>
        <TableCaption className="sr-only">{L.topTitle}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">{L.sku}</TableHead>
            <TableHead scope="col">{L.productName}</TableHead>
            <TableHead scope="col" className="text-right">
              {L.quantitySold}
            </TableHead>
            <TableHead scope="col" className="text-right">
              {L.revenue}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.sku}>
              <TableCell className="font-mono">{row.sku}</TableCell>
              <TableCell>{topProductLabel(row)}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {formatNumber(row.quantitySold)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {formatMoney(row.revenue)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ReportCard>
  );
}

export function OrderStatusWidget() {
  const query = useOrderStatusCounts(true);
  const all = toStatusBars(query.data ?? []);
  const bars = visibleStatusBars(all);
  return (
    <ReportCard
      title={L.statusTitle}
      isPending={query.isPending}
      isError={query.isError}
      isEmpty={all.every((bar) => bar.count === 0)}
      onRetry={() => void query.refetch()}
    >
      <OrderStatusChart bars={bars} />
    </ReportCard>
  );
}
