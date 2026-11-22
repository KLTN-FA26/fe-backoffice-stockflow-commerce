import { TripRoutePage } from "../../_components/TripRoutePages";

export default async function PutawayTripByIdRoute({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  return <TripRoutePage tripId={decodeURIComponent(tripId)} />;
}
