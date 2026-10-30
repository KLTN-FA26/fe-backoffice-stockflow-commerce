"use client";

import { AreaDialog } from "./AreaDialog";
import { BoundaryDialog } from "./BoundaryDialog";
import { ShelfDialog } from "./ShelfDialog";
import { ZoneDialog } from "./ZoneDialog";

import type { WarehouseLayout } from "@/features/warehouse-map/types";
import type { EditorKind } from "../MapToolbar";

/** Mở đúng dialog vẽ bản đồ theo nút được bấm; mỗi dialog kiểm trước BR với bố cục hiện tại. */
export function MapEditors({
  kind,
  layout,
  onClose,
}: {
  kind: EditorKind;
  layout: WarehouseLayout;
  onClose: () => void;
}) {
  switch (kind) {
    case "zone":
      return <ZoneDialog layout={layout} onClose={onClose} />;
    case "shelf":
      return <ShelfDialog layout={layout} onClose={onClose} />;
    case "area":
      return <AreaDialog layout={layout} onClose={onClose} />;
    case "boundary":
      return <BoundaryDialog layout={layout} onClose={onClose} />;
  }
}
