"use client";

import { Text } from "react-konva";

import { AREA_TYPE_LABELS } from "@/constants";

import { LABEL_SIZE } from "../../map/shape-utils";

import type { DraftPlace } from "@/features/warehouse-map/draft";
import type { CanvasPalette } from "./use-canvas-palette";

/** Nhãn trong hình: mã kệ mono giữa khối; khu vực ghi mã + loại ở góc trên-trái (như bản đồ 2D xem). */
export function PlaceLabel({
  item,
  width,
  height,
  palette,
}: {
  item: DraftPlace;
  width: number;
  height: number;
  palette: CanvasPalette;
}) {
  const shelf = item.kind === "shelf";
  return (
    <Text
      text={shelf ? item.code : `${item.code}\n${AREA_TYPE_LABELS[item.type]}`}
      width={width}
      height={height}
      padding={shelf ? 0 : 0.3}
      align={shelf ? "center" : "left"}
      verticalAlign={shelf ? "middle" : "top"}
      fontSize={LABEL_SIZE}
      fontFamily={shelf ? palette.mono : palette.sans}
      fontStyle={shelf ? "bold" : "normal"}
      fill={palette.ink}
      listening={false}
    />
  );
}
