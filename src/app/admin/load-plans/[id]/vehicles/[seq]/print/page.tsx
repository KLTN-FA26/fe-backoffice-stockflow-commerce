import { LoadSheetPrint } from "@/features/load-planning/components/print/LoadSheetPrint";

export default async function LoadSheetPrintPage({
  params,
}: {
  params: Promise<{ id: string; seq: string }>;
}) {
  const { id, seq } = await params;
  // `Number("")` = 0 và `Number("1.5")` = 1.5 đều bị màn hình từ chối (chỉ nhận số nguyên ≥ 1)
  return <LoadSheetPrint id={id} seq={Number(seq)} />;
}
