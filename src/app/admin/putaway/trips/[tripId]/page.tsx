import { TripPage } from "@/features/putaway";

export default async function PutawayTripByIdRoute({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  return <TripPage tripId={decodeURIComponent(tripId)} />;
}
