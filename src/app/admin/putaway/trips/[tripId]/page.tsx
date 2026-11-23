import { TripRedirect } from "@/features/putaway";

/** Route cũ: chuyến theo id giờ nằm trong tab theo kho của chuyến (spec §5.5). */
export default async function LegacyTripPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  return <TripRedirect tripId={decodeURIComponent(tripId)} />;
}
