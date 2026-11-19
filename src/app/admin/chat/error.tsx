"use client";

import { RouteError } from "@/components/backoffice/RouteStates";

export default function Error({ reset }: { reset: () => void }) {
  return <RouteError reset={reset} />;
}
