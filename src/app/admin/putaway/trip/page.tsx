import { MyTripRedirect } from "@/features/putaway";

/** Route cũ: chuyến cất hàng giờ nằm trong tab theo kho (spec §5.5). */
export default async function LegacyMyTripPage({
  searchParams,
}: {
  searchParams: Promise<{ warehouse?: string | string[] }>;
}) {
  const { warehouse } = await searchParams;
  return <MyTripRedirect warehouseId={typeof warehouse === "string" ? warehouse : null} />;
}
